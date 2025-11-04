import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import { X, Shield, UserRound, Check, XCircle, Upload, Users, Image as ImageIcon, Link as LinkIcon, Music2, Search } from 'lucide-react';
import CampaignContextCard from './CampaignContextCard';
import { approveInvite, getSharedMedia, inviteMember, rejectInvite, setGroupRole, updateGroupSettings, getConversation } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';
import { uploadImageAsBase64 } from '../utils/base64Upload';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * GroupInfoPanel - right-side drawer for managing a group conversation
 * Props:
 *  - conversationId: string
 *  - open: boolean
 *  - onClose: () => void
 */
const GroupInfoPanel = ({ conversationId, open, onClose }) => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | shared
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [invitePermission, setInvitePermission] = useState('approval');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [media, setMedia] = useState({ images: [], audios: [], campaigns: [], links: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const imageInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const isAdmin = useMemo(() => {
    // Check if user is creator or has admin role
    return conv?.createdBy === currentUser?.uid || conv?.roles?.[currentUser?.uid] === 'admin';
  }, [conv, currentUser?.uid]);

  useEffect(() => {
    if (!open || !conversationId) return;
    (async () => {
      setLoading(true);
      try {
        const c = await getConversation(conversationId);
        setConv(c);
        const settings = c?.settings || {};
        setName(settings.name || c?.groupName || 'Group Chat');
        setImageUrl(settings.groupImageUrl || '');
        setInvitePermission(settings.invitePermission || 'approval');
        const m = await getSharedMedia(conversationId, 200);
        setMedia(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId]);

  // User search with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const searchLower = searchQuery.toLowerCase().trim();
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('displayName', '>=', searchLower),
          where('displayName', '<=', searchLower + '\uf8ff'),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => ({
            uid: doc.id,
            ...doc.data()
          }))
          // Filter out users already in the conversation
          .filter(user => !conv?.participants?.includes(user.uid));
        
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, conv?.participants]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const base64 = await uploadImageAsBase64(file);
      setImageUrl(base64);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateGroupSettings(conversationId, currentUser.uid, {
        name,
        groupImageUrl: imageUrl,
        invitePermission,
      });
      // update local immediately (both settings and groupName for backward compatibility)
      setConv(prev => ({ 
        ...prev, 
        settings: { ...(prev?.settings || {}), name, groupImageUrl: imageUrl, invitePermission },
        groupName: name // Also update groupName for backward compatibility
      }));
      alert('Group settings updated successfully!');
    } catch (e) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (userId) => {
    if (!userId) return;
    try {
      const res = await inviteMember(conversationId, currentUser.uid, userId);
      if (res.status === 'joined') {
        setConv(prev => ({ ...prev, participants: [...(prev.participants || []), userId] }));
      } else if (res.status === 'pending') {
        setConv(prev => ({ ...prev, pendingInvites: { ...(prev.pendingInvites || {}), [userId]: { invitedBy: currentUser.uid, invitedAt: new Date() } } }));
      }
      // Clear search after successful invite
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) {
      alert(e.message || 'Invite failed');
    }
  };

  const handleApprove = async (uid) => {
    try {
      await approveInvite(conversationId, currentUser.uid, uid);
      setConv(prev => ({
        ...prev,
        participants: [...(prev.participants || []), uid],
        pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined },
      }));
    } catch (e) { alert(e.message || 'Approve failed'); }
  };

  const handleReject = async (uid) => {
    try {
      await rejectInvite(conversationId, currentUser.uid, uid);
      setConv(prev => ({ ...prev, pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined } }));
    } catch (e) { alert(e.message || 'Reject failed'); }
  };

  const handleRole = async (uid, role) => {
    try {
      await setGroupRole(conversationId, currentUser.uid, uid, role);
      setConv(prev => ({ ...prev, roles: { ...(prev.roles || {}), [uid]: role } }));
    } catch (e) { alert(e.message || 'Change role failed'); }
  };

  if (!open) return null;

  const panelClass = isDarkMode
    ? 'bg-gray-900 text-gray-100'
    : 'bg-white text-gray-900';

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className={`relative w-full max-w-2xl h-[90vh] ${panelClass} rounded-2xl shadow-2xl flex flex-col animate-slideUp overflow-hidden`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Users size={22} /> Group Info</h3>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Header info */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} className="text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-lg truncate">{conv?.settings?.name || conv?.groupName || 'Group Chat'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{(conv?.participants || []).length} members</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="p-6 flex gap-3 border-b border-gray-200 dark:border-gray-800">
              <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab==='overview'?'bg-green-600 text-white shadow-md':'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={()=>setTab('overview')}>Overview</button>
              <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab==='shared'?'bg-green-600 text-white shadow-md':'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} onClick={()=>setTab('shared')}>Shared Media</button>
            </div>

            {tab === 'overview' ? (
              <div className="p-6 space-y-6">
                {/* Admin controls */}
                <div className="space-y-4">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Group settings</div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input value={name} onChange={(e)=>setName(e.target.value)} disabled={!isAdmin} className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group Avatar</label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt="Group avatar" className="w-full h-full object-cover" />
                        ) : (
                          <Users size={32} className="text-gray-500 dark:text-gray-400" />
                        )}
                      </div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={!isAdmin}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={!isAdmin || uploadingImage}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {uploadingImage ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            Upload Image
                          </>
                        )}
                      </button>
                      {imageUrl && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" disabled={!isAdmin} checked={invitePermission==='approval'} onChange={(e)=>setInvitePermission(e.target.checked?'approval':'auto')} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Require admin approval for invites</span>
                  </div>
                  {isAdmin && (
                    <button disabled={saving} onClick={handleSaveSettings} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">{saving? 'Saving…':'Save settings'}</button>
                  )}
                </div>

                {/* Invite */}
                <div className="space-y-4">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Invite member</div>
                  <div className="relative">
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={searchQuery}
                        onChange={(e)=>setSearchQuery(e.target.value)}
                        placeholder="Search people by name..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    {searching && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">Searching...</div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-60 overflow-y-auto scrollbar-hide space-y-2 border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800">
                        {searchResults.map(user => (
                          <div key={user.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <UserRound size={20} className="text-gray-500 dark:text-gray-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.displayName || 'Anonymous'}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{user.email}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleInvite(user.uid)}
                              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">No users found</div>
                    )}
                  </div>
                  {conv?.pendingInvites && Object.keys(conv.pendingInvites).length>0 && (
                    <div className="mt-4 text-sm">
                      <div className="text-gray-900 dark:text-gray-100 font-medium mb-3">Pending approvals</div>
                      <ul className="space-y-2">
                        {Object.keys(conv.pendingInvites).map(uid=> (
                          <li key={uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><UserRound size={16} /><span>{uid}</span></div>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <button onClick={()=>handleApprove(uid)} className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"><Check size={14}/>Approve</button>
                                <button onClick={()=>handleReject(uid)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"><XCircle size={14}/>Reject</button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="space-y-3">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Members</div>
                  <ul className="space-y-2 max-h-80 overflow-auto scrollbar-hide pr-1">
                    {(conv?.participants || []).map(uid => {
                      const name = conv?.participantNames?.[uid] || uid;
                      const photo = conv?.participantPhotos?.[uid] || '';
                      const role = conv?.roles?.[uid] || 'member';
                      return (
                        <li key={uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              {photo ? <img src={photo} alt={name} className="w-full h-full object-cover"/> : <UserRound size={20} className="text-gray-500 dark:text-gray-400"/>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">{role==='admin'?<Shield size={12}/>:null}{role}</div>
                            </div>
                          </div>
                          {isAdmin && currentUser?.uid !== uid && (
                            <select className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500" value={role} onChange={(e)=>handleRole(uid, e.target.value)}>
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Images */}
                {media.images.length>0 && (
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><ImageIcon size={18}/>Images</div>
                    <div className="grid grid-cols-3 gap-3">
                      {media.images.map(img => (
                        <img key={img.id} src={img.url} alt="shared" className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700"/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {media.audios.length>0 && (
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><Music2 size={18}/>Audio</div>
                    <div className="space-y-2">
                      {media.audios.map(a => (
                        <audio key={a.id} controls src={a.url} className="w-full" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Campaigns */}
                {media.campaigns.length>0 && (
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Campaigns</div>
                    <div className="space-y-3">
                      {media.campaigns.map(c => (
                        <CampaignContextCard key={c.id} campaign={c.campaign} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {media.links.length>0 && (
                  <div>
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><LinkIcon size={18}/>Links</div>
                    <ul className="space-y-2 text-sm">
                      {media.links.map(l => (
                        <li key={l.id} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800"><a className="text-blue-600 dark:text-blue-400 hover:underline break-all" href={l.url} target="_blank" rel="noreferrer">{l.url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}

                {media.images.length===0 && media.audios.length===0 && media.campaigns.length===0 && media.links.length===0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">No shared media yet.</div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  , document.body);
};

export default GroupInfoPanel;
