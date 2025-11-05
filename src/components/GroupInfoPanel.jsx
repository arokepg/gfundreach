import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { default as X } from '@mui/icons-material/Close';
import { default as Shield } from '@mui/icons-material/Shield';
import { default as UserRound } from '@mui/icons-material/AccountCircle';
import { default as Check } from '@mui/icons-material/Check';
import { default as XCircle } from '@mui/icons-material/Cancel';
import { default as Upload } from '@mui/icons-material/Upload';
import { default as Users } from '@mui/icons-material/Group';
import { default as ImageIcon } from '@mui/icons-material/Image';
import { default as LinkIcon } from '@mui/icons-material/Link';
import { default as Music2 } from '@mui/icons-material/MusicNote';
import { default as Search } from '@mui/icons-material/Search';
import { default as Trash2 } from '@mui/icons-material/DeleteOutline';
import { default as LogOut } from '@mui/icons-material/Logout';
import CampaignContextCard from './CampaignContextCard';
import { approveInvite, getSharedMedia, inviteMember, rejectInvite, setGroupRole, updateGroupSettings, getConversation, backfillParticipantPhotos, removeMemberFromGroup, leaveGroup } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';
import { uploadImageAsBase64 } from '../utils/base64Upload';
import { db } from '../config/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { listFriendIds } from '../utils/friends';

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
  const navigate = useNavigate();
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
  const [friends, setFriends] = useState([]); // [{uid, displayName, photoURL, email}]
  const [loadingFriends, setLoadingFriends] = useState(false);
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
        
        // Backfill missing participant photos
        if (c?.type === 'group') {
          const participantPhotos = c.participantPhotos || {};
          const participantNames = c.participantNames || {};
          const participants = c.participants || [];
          const hasMissingProfiles = participants.some(uid => !participantPhotos[uid] || !participantNames[uid] || participantNames[uid] === uid || participantNames[uid] === 'User');

          if (hasMissingProfiles) {
            backfillParticipantPhotos(conversationId).catch(err => 
              console.warn('Failed to backfill profiles:', err)
            );
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId]);

  // Load current user's friends (profiles) once when panel opens
  useEffect(() => {
    if (!open || !currentUser?.uid) return;
    (async () => {
      try {
        setLoadingFriends(true);
        const ids = await listFriendIds(currentUser.uid);
        if (!ids || ids.length === 0) {
          setFriends([]);
          return;
        }
        // Fetch user profiles by id (simple fan-out)
        const snaps = await Promise.all(ids.map((uid) => getDoc(doc(db, 'users', uid)).catch(() => null)));
        const profiles = snaps
          .filter((s) => s && s.exists())
          .map((s) => ({ uid: s.id, ...(s.data() || {}) }));
        setFriends(profiles);
      } catch (err) {
        console.warn('Failed to load friends:', err);
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    })();
  }, [open, currentUser?.uid]);

  // User search within Friends with debouncing (by name)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Allow empty/short queries to show nothing
    if (!searchQuery || searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const searchLower = searchQuery.toLowerCase().trim();
        const pending = Object.keys(conv?.pendingInvites || {});
        // Filter friends locally by name or email
        const results = friends
          .filter((f) => !conv?.participants?.includes(f.uid))
          .filter((f) => !pending.includes(f.uid))
          .filter((f) => (f.displayName || '').toLowerCase().includes(searchLower))
          .slice(0, 10);

        setSearchResults(results);
      } catch (error) {
        console.error('Error filtering friends:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, conv?.participants, conv?.pendingInvites, friends]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const base64 = await uploadImageAsBase64(file);
      setImageUrl(base64);
      // Persist immediately so other views (header, list) update in real time
      try {
        await updateGroupSettings(conversationId, currentUser.uid, { groupImageUrl: base64 });
        setConv(prev => ({
          ...prev,
          settings: { ...(prev?.settings || {}), groupImageUrl: base64 }
        }));
      } catch (persistErr) {
        console.warn('Failed to persist group avatar immediately; will rely on Save button:', persistErr);
      }
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
      // Fetch user's profile to capture display name and avatar
      let userName = 'User';
      let userPhoto = '';
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          const u = snap.data() || {};
          userName = u.displayName || u.email || 'User';
          userPhoto = u.photoURL || '';
        }
      } catch {/* non-fatal */}

      const res = await inviteMember(conversationId, currentUser.uid, userId, userName, userPhoto);
      if (res.status === 'joined') {
        // Joined immediately (auto mode or inviter is admin): update local maps so UI shows name/photo
        setConv(prev => ({
          ...prev,
          participants: [...(prev.participants || []), userId],
          participantNames: { ...(prev.participantNames || {}), [userId]: userName },
          participantPhotos: { ...(prev.participantPhotos || {}), [userId]: userPhoto },
          roles: { ...(prev.roles || {}), [userId]: 'member' },
          unreadCount: { ...(prev.unreadCount || {}), [userId]: 0 },
        }));
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
      // Resolve user profile to store name/photo for the approved member
      let userName = 'User';
      let userPhoto = '';
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const u = snap.data() || {};
          userName = u.displayName || u.email || 'User';
          userPhoto = u.photoURL || '';
        }
      } catch {/* ignore */}

      await approveInvite(conversationId, currentUser.uid, uid, userName, userPhoto);
      setConv(prev => ({
        ...prev,
        participants: [...(prev.participants || []), uid],
        participantNames: { ...(prev.participantNames || {}), [uid]: userName },
        participantPhotos: { ...(prev.participantPhotos || {}), [uid]: userPhoto },
        roles: { ...(prev.roles || {}), [uid]: 'member' },
        unreadCount: { ...(prev.unreadCount || {}), [uid]: 0 },
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

  const handleRemoveMember = async (uid) => {
    const memberName = conv?.participantNames?.[uid] || uid;
    if (!confirm(`Are you sure you want to remove ${memberName} from the group?`)) {
      return;
    }
    
    try {
      await removeMemberFromGroup(conversationId, currentUser.uid, uid, memberName);
      setConv(prev => ({
        ...prev,
        participants: (prev.participants || []).filter(id => id !== uid),
      }));
      alert('Member removed successfully');
    } catch (e) {
      alert(e.message || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    const userName = currentUser?.displayName || 'User';
    
    // Check if user is the only admin
    const roles = conv?.roles || {};
    const isCurrentUserAdmin = conv?.createdBy === currentUser?.uid || roles[currentUser?.uid] === 'admin';
    
    if (isCurrentUserAdmin) {
      const adminCount = (conv?.participants || []).filter(id => 
        conv?.createdBy === id || roles[id] === 'admin'
      ).length;
      
      if (adminCount === 1 && (conv?.participants || []).length > 1) {
        alert('You are the only admin. Please promote another member to admin before leaving.');
        return;
      }
    }
    
    if (!confirm('Are you sure you want to leave this group?')) {
      return;
    }
    
    try {
      await leaveGroup(conversationId, currentUser.uid, userName);
      onClose(); // Close the panel first
      // Redirect to messages page
      navigate('/messages');
    } catch (e) {
      alert(e.message || 'Failed to leave group');
    }
  };

  const canLeaveGroup = useMemo(() => {
    // Admin can leave if there are other admins OR if they're the only member
    const roles = conv?.roles || {};
    const isCurrentUserAdmin = conv?.createdBy === currentUser?.uid || roles[currentUser?.uid] === 'admin';
    
    if (!isCurrentUserAdmin) {
      return true; // Regular members can always leave
    }
    
    const participants = conv?.participants || [];
    const adminCount = participants.filter(id => 
      conv?.createdBy === id || roles[id] === 'admin'
    ).length;
    
    // Can leave if: more than one admin, OR only member in group
    return adminCount > 1 || participants.length === 1;
  }, [conv, currentUser?.uid]);

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
                    {(searching || loadingFriends) && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{loadingFriends ? 'Loading friends...' : 'Searching...'}</div>
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
                    {searchQuery.trim().length >= 1 && !searching && searchResults.length === 0 && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">No matching friends</div>
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
                      const isCurrentUser = uid === currentUser?.uid;
                      return (
                        <li key={uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              {photo ? <img src={photo} alt={name} className="w-full h-full object-cover"/> : <UserRound size={20} className="text-gray-500 dark:text-gray-400"/>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {name}
                                {isCurrentUser && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">{role==='admin'?<Shield size={12}/>:null}{role}</div>
                            </div>
                          </div>
                          {isAdmin && !isCurrentUser && (
                            <div className="flex items-center gap-2">
                              <select className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500" value={role} onChange={(e)=>handleRole(uid, e.target.value)}>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button
                                onClick={() => handleRemoveMember(uid)}
                                className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                                title="Remove member"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Leave Group Button */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={handleLeaveGroup}
                    disabled={!canLeaveGroup}
                    className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    title={!canLeaveGroup ? 'You must promote another admin before leaving' : 'Leave this group'}
                  >
                    <LogOut size={18} />
                    Leave Group
                  </button>
                  {!canLeaveGroup && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                      You are the only admin. Promote another member to admin before leaving.
                    </p>
                  )}
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
