import { useEffect, useMemo, useState, useRef } from 'react';
import { X, Shield, UserRound, Check, XCircle, Users, Image as ImageIcon, Link as LinkIcon, Music2, Search } from 'lucide-react';
import ImageViewer from './ImageViewer';
import CampaignContextCard from './CampaignContextCard';
import { approveInvite, getSharedMedia, inviteMember, rejectInvite, setGroupRole, updateGroupSettings, getConversation, removeGroupMember } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { listFriendIds } from '../utils/friends';

// Clean, merged GroupInfoPanel implementation
const GroupInfoPanel = ({ conversationId, open, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | shared
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [invitePermission, setInvitePermission] = useState('approval');
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState({ images: [], audios: [], campaigns: [], links: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [imagePreview, setImagePreview] = useState({ open: false, src: '', alt: '' });

  const isAdmin = useMemo(() => conv?.roles?.[currentUser?.uid] === 'admin', [conv, currentUser?.uid]);

  useEffect(() => {
    if (!open || !conversationId) return;
    (async () => {
      setLoading(true);
      try {
        const c = await getConversation(conversationId);
        if (!c) {
          setLoading(false);
          return;
        }
        // Ensure participant names/photos are populated
        const participantsWithInfo = { ...c };
        const missingUsers = (c?.participants || []).filter(uid =>
          !c?.participantNames?.[uid] || c?.participantNames?.[uid] === uid || c?.participantNames?.[uid] === 'User'
        );
        if (missingUsers.length > 0) {
          const userInfos = await Promise.all(
            missingUsers.map(async (uid) => {
              try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  return {
                    uid,
                    displayName: data.displayName || data.email || uid,
                    photoURL: data.photoURL || ''
                  };
                }
              } catch (err) {
                console.error('Error fetching user:', uid, err);
              }
              return { uid, displayName: uid, photoURL: '' };
            })
          );
          participantsWithInfo.participantNames = { ...(c?.participantNames || {}) };
          participantsWithInfo.participantPhotos = { ...(c?.participantPhotos || {}) };
          const updates = {};
          userInfos.forEach(info => {
            participantsWithInfo.participantNames[info.uid] = info.displayName;
            participantsWithInfo.participantPhotos[info.uid] = info.photoURL;
            updates[`participantNames.${info.uid}`] = info.displayName;
            updates[`participantPhotos.${info.uid}`] = info.photoURL;
          });
          try {
            await updateDoc(doc(db, 'conversations', conversationId), updates);
          } catch (err) {
            console.error('Error updating participant info:', err);
          }
        }
        setConv(participantsWithInfo);
        const settings = participantsWithInfo?.settings || {};
        setName(settings.name || participantsWithInfo?.groupName || 'Group Chat');
        setImageUrl(settings.groupImageUrl || '');
        setInvitePermission(settings.invitePermission || 'approval');
        const m = await getSharedMedia(conversationId, 200);
        setMedia(m);

        // Load friends list
        setLoadingFriends(true);
        try {
          const friendIds = await listFriendIds(currentUser.uid);
          const friendsData = await Promise.all(
            friendIds.map(async (friendId) => {
              const userDoc = await getDoc(doc(db, 'users', friendId));
              if (userDoc.exists()) {
                return { uid: friendId, ...userDoc.data() };
              }
              return null;
            })
          );
          setFriends(friendsData.filter(Boolean));
        } catch (err) {
          console.error('Error loading friends:', err);
        } finally {
          setLoadingFriends(false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId, currentUser.uid]);

  // Remove member (admin only)
  const handleRemoveMember = async (uid) => {
    if (!conv || !conversationId) return;
    if (!confirm('Remove this member from the group?')) return;
    try {
      await removeGroupMember(conversationId, currentUser.uid, uid);
      setConv((prev) => {
        const next = { ...(prev || {}) };
        next.participants = (prev?.participants || []).filter((id) => id !== uid);
        next.participantNames = { ...(prev?.participantNames || {}) };
        next.participantPhotos = { ...(prev?.participantPhotos || {}) };
        next.roles = { ...(prev?.roles || {}) };
        delete next.participantNames[uid];
        delete next.participantPhotos[uid];
        delete next.roles[uid];
        return next;
      });
    } catch (err) {
      alert(err.message || 'Failed to remove member');
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearching(true);
      try {
        const q = searchQuery.toLowerCase().trim();
        const results = friends
          .filter(f => ((f.displayName || '').toLowerCase().includes(q)) || ((f.email || '').toLowerCase().includes(q)))
          .filter(f => !conv?.participants?.includes(f.uid));
        setSearchResults(results);
      } catch (e) {
        console.error('search error', e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => searchTimeoutRef.current && clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, friends, conv?.participants]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateGroupSettings(conversationId, currentUser.uid, { name, groupImageUrl: imageUrl, invitePermission });
      setConv(prev => ({ ...prev, settings: { ...(prev?.settings || {}), name, groupImageUrl: imageUrl, invitePermission } }));
    } catch (e) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (user) => {
    if (!user || !user.uid) return;
    try {
      const res = await inviteMember(
        conversationId,
        currentUser.uid,
        user.uid,
        user.displayName || user.email || 'User',
        user.photoURL || ''
      );
      if (res.status === 'joined') {
        setConv(prev => ({
          ...prev,
          participants: [...(prev.participants || []), user.uid],
          participantNames: { ...(prev.participantNames || {}), [user.uid]: user.displayName || user.email || 'User' },
          participantPhotos: { ...(prev.participantPhotos || {}), [user.uid]: user.photoURL || '' },
          roles: { ...(prev.roles || {}), [user.uid]: 'member' }
        }));
      } else if (res.status === 'pending') {
        setConv(prev => ({
          ...prev,
          pendingInvites: {
            ...(prev.pendingInvites || {}),
            [user.uid]: {
              invitedBy: currentUser.uid,
              invitedAt: new Date(),
              displayName: user.displayName || user.email || 'User',
              photoURL: user.photoURL || ''
            }
          }
        }));
      }
    } catch (e) {
      alert(e.message || 'Invite failed');
    }
  };

  const handleApprove = async (uid) => {
    try {
      const invite = conv?.pendingInvites?.[uid];
      const userName = invite?.displayName || 'User';
      const userPhoto = invite?.photoURL || '';
      await approveInvite(conversationId, currentUser.uid, uid, userName, userPhoto);
      setConv(prev => ({
        ...prev,
        participants: [...(prev.participants || []), uid],
        participantNames: { ...(prev.participantNames || {}), [uid]: userName },
        participantPhotos: { ...(prev.participantPhotos || {}), [uid]: userPhoto },
        roles: { ...(prev.roles || {}), [uid]: 'member' },
        pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined }
      }));
    } catch (e) {
      alert(e.message || 'Approve failed');
    }
  };

  const handleReject = async (uid) => {
    try {
      await rejectInvite(conversationId, currentUser.uid, uid);
      setConv(prev => ({ ...prev, pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined } }));
    } catch (e) {
      alert(e.message || 'Reject failed');
    }
  };

  const handleRole = async (uid, role) => {
    try {
      await setGroupRole(conversationId, currentUser.uid, uid, role);
      setConv(prev => ({ ...prev, roles: { ...(prev.roles || {}), [uid]: role } }));
    } catch (e) {
      alert(e.message || 'Change role failed');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-gray-900 border-l border-themed-border shadow-xl flex flex-col">
        <div className="p-4 border-b border-themed-border flex items-center justify-between">
          <h3 className="font-semibold text-themed flex items-center gap-2"><Users size={18} /> Group Info</h3>
          <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-themed-muted">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Header info */}
            <div className="p-4 border-b border-themed-border flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Users size={24} className="text-themed-muted" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-themed truncate">{conv?.settings?.name || conv?.groupName || 'Group Chat'}</div>
                <div className="text-xs text-themed-muted">{(conv?.participants || []).length} members</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="p-4 flex gap-2 border-b border-themed-border">
              <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='overview'?'bg-green-600 text-white':'bg-themed-secondary text-themed'}`} onClick={()=>setTab('overview')}>Overview</button>
              <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='shared'?'bg-green-600 text-white':'bg-themed-secondary text-themed'}`} onClick={()=>setTab('shared')}>Shared Media</button>
            </div>

            {tab === 'overview' ? (
              <div className="p-4 space-y-6">
                {/* Admin controls */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-themed">Group settings</div>
                  <div className="space-y-2">
                    <label className="block text-xs text-themed-muted">Name</label>
                    <input value={name} onChange={(e)=>setName(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded border border-themed-border bg-themed" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-themed-muted">Avatar URL</label>
                    <input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded border border-themed-border bg-themed" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled={!isAdmin} checked={invitePermission==='approval'} onChange={(e)=>setInvitePermission(e.target.checked?'approval':'auto')} />
                    <span className="text-sm text-themed">Require admin approval for invites</span>
                  </div>
                  {isAdmin && (
                    <button disabled={saving} onClick={handleSaveSettings} className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving? 'Saving…':'Save settings'}</button>
                  )}
                </div>

                {/* Invite */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Invite member</div>
                    {loadingFriends && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent" />
                        Loading friends...
                      </div>
                    )}
                    {!loadingFriends && friends.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {friends.length} friend{friends.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={searchQuery}
                        onChange={(e)=>setSearchQuery(e.target.value)}
                        placeholder="Search friends by name or email..."
                        disabled={loadingFriends || friends.length === 0}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    {friends.length === 0 && !loadingFriends && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        No friends to invite. Add friends first to invite them to this group.
                      </div>
                    )}
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
                            <button onClick={() => handleInvite(user)} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">Invite</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && friends.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">No friends found matching "{searchQuery}"</div>
                    )}
                  </div>
                  {conv?.pendingInvites && Object.keys(conv.pendingInvites).filter(uid => conv.pendingInvites[uid]).length > 0 && (
                    <div className="mt-4 text-sm">
                      <div className="text-gray-900 dark:text-gray-100 font-medium mb-3">Pending approvals</div>
                      <ul className="space-y-2">
                        {Object.keys(conv.pendingInvites).filter(uid => conv.pendingInvites[uid]).map(uid => {
                          const invite = conv.pendingInvites[uid];
                          const displayName = invite?.displayName || uid;
                          const photoURL = invite?.photoURL || '';
                          return (
                            <li key={uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  {photoURL ? (
                                    <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserRound size={18} className="text-gray-500 dark:text-gray-400" />
                                  )}
                                </div>
                                <span className="text-gray-700 dark:text-gray-300 truncate">{displayName}</span>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  <button onClick={()=>handleApprove(uid)} className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"><Check size={14}/>Approve</button>
                                  <button onClick={()=>handleReject(uid)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1 transition-colors"><XCircle size={14}/>Reject</button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-themed">Members</div>
                  <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                    {(conv?.participants || []).map(uid => {
                      const name = conv?.participantNames?.[uid] || uid;
                      const photo = conv?.participantPhotos?.[uid] || '';
                      const role = conv?.roles?.[uid] || 'member';
                      return (
                        <li key={uid} className="flex items-center justify-between p-2 rounded border border-themed-border">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              {photo ? <img src={photo} alt={name} className="w-full h-full object-cover"/> : <UserRound size={18} className="text-themed-muted"/>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm text-themed truncate">{name}</div>
                              <div className="text-xs text-themed-muted flex items-center gap-1">{role==='admin'?<Shield size={12}/>:null}{role}</div>
                            </div>
                          </div>
                          {isAdmin && role !== 'admin' && currentUser?.uid !== uid && (
                            <div className="flex items-center gap-2">
                              <select className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500" value={role} onChange={(e)=>handleRole(uid, e.target.value)}>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button onClick={() => handleRemoveMember(uid)} className="text-sm px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:ring-2 focus:ring-red-500" type="button" title="Remove from group">Delete</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Images */}
                {media.images.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><ImageIcon size={16}/>Images</div>
                    <div className="grid grid-cols-3 gap-2">
                      {media.images.map(img => (
                        <img key={img.id} src={img.url} alt="shared" className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-zoom-in" onClick={() => setImagePreview({ open: true, src: img.url, alt: 'Shared image' })} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {media.audios.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><Music2 size={16}/>Audio</div>
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
                    <div className="text-sm font-semibold text-themed mb-2">Campaigns</div>
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
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><LinkIcon size={16}/>Links</div>
                    <ul className="space-y-1 text-sm">
                      {media.links.map(l => (
                        <li key={l.id}><a className="text-blue-600 hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}

                {media.images.length===0 && media.audios.length===0 && media.campaigns.length===0 && media.links.length===0 && (
                  <div className="text-sm text-themed-muted">No shared media yet.</div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
      <ImageViewer open={imagePreview.open} src={imagePreview.src} alt={imagePreview.alt} onClose={() => setImagePreview({ open: false, src: '', alt: '' })} />
    </div>
  );
};

export default GroupInfoPanel;
