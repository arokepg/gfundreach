import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import PostCard from '../../components/PostCard';
import GroupItemCard from '../../components/GroupItemCard';
import { useAuth } from '../../contexts/AuthContext';
import { getGroup, getMember, joinGroup, leaveGroup, listGroupPosts, listPendingGroupPosts, listMembers, setMemberRole, approveGroupPost, rejectGroupPost, updateGroup, softDeleteGroup, removeMember } from '../../utils/groups';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import PersonIcon from '@mui/icons-material/Person';
import ImageIcon from '@mui/icons-material/Image';
import EditIcon from '@mui/icons-material/Edit';

const RoleSelect = ({ value, onChange, disabled }) => (
  <select
    value={value}
    onChange={(e)=> onChange(e.target.value)}
    disabled={disabled}
    className="text-sm px-2 py-1 rounded-lg border border-outline-variant bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
  >
    <option value="admin">Admin</option>
    <option value="moderator">Moderator</option>
    <option value="member">Member</option>
  </select>
);

const GroupDetail = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupCampaigns, setGroupCampaigns] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBanner, setEditBanner] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // Mobile tab state

  const isAdmin = useMemo(() => member?.role === 'admin', [member]);
  const isModerator = useMemo(() => member?.role === 'moderator', [member]);
  const isMember = useMemo(() => !!member, [member]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const g = await getGroup(id);
        if (!cancelled) setGroup(g);

        if (currentUser) {
          try {
            const m = await getMember(id, currentUser.uid);
            if (!cancelled) setMember(m);
          } catch (err) {
            console.warn('Failed to fetch member role (non-fatal):', err);
          }
        }

        try {
          const lst = await listGroupPosts(id);
          if (!cancelled) setPosts(lst);
        } catch (err) {
          console.warn('Failed to list group posts (non-fatal):', err);
          if (!cancelled) setPosts([]);
        }

        try {
          const pend = await listPendingGroupPosts(id);
          if (!cancelled) setPendingPosts(pend);
        } catch (err) {
          console.warn('Failed to list pending posts (non-fatal):', err);
          if (!cancelled) setPendingPosts([]);
        }

        try {
          const mem = await listMembers(id);
          // Sort: admins first, then moderators, then members; then by displayName
          const roleRank = (r) => (r === 'admin' ? 0 : r === 'moderator' ? 1 : 2);
          const sorted = [...mem].sort((a, b) => {
            const rr = roleRank(a.role) - roleRank(b.role);
            if (rr !== 0) return rr;
            return (a.displayName || '').localeCompare(b.displayName || '');
          });
          if (!cancelled) setMembers(sorted);
        } catch (err) {
          console.warn('Failed to list members (non-fatal):', err);
          if (!cancelled) setMembers([]);
        }

        // Fetch group campaigns (posts with groupId == id)
        try {
          // Avoid composite index requirement: query by equality then sort client-side
          const q = query(collection(db, 'posts'), where('groupId', '==', id));
          const snap = await getDocs(q);
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
          items.sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return tb - ta;
          });
          if (!cancelled) setGroupCampaigns(items);
        } catch (err) {
          console.warn('Failed to list group campaigns (non-fatal):', err);
          if (!cancelled) setGroupCampaigns([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, currentUser]);

  const handleJoin = async () => {
    if (!currentUser) return alert('Please log in to join');
    await joinGroup(id, currentUser.uid);
    const m = await getMember(id, currentUser.uid);
    setMember(m);
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    // Prevent admins from leaving their own group
    if (isAdmin) {
      alert('Admins cannot leave their own group. Transfer ownership or delete the group instead.');
      return;
    }
    await leaveGroup(id, currentUser.uid);
    setMember(null);
  };

  // Note: group feed composer removed in favor of creating campaigns; unused post composer code removed.

  const changeRole = async (uid, role) => {
    try {
      await setMemberRole(id, uid, role);
      const mem = await listMembers(id);
      setMembers(mem);
      if (uid === currentUser?.uid) {
        const m = await getMember(id, currentUser.uid);
        setMember(m);
      }
    } catch (e) {
      console.error('Failed to change role:', e);
      alert('Failed to change role. You might not have permission or the group data is outdated.');
    }
  };

  const approvePost = async (postId) => {
    if (!isAdmin && !isModerator) return;
    await approveGroupPost(id, postId, currentUser.uid);
    setPosts(await listGroupPosts(id));
    setPendingPosts(await listPendingGroupPosts(id));
  };

  const rejectPost = async (postId) => {
    if (!isAdmin && !isModerator) return;
    if (!window.confirm('Reject and remove this post?')) return;
    await rejectGroupPost(id, postId);
    setPendingPosts(await listPendingGroupPosts(id));
  };

  const kickMember = async (uid) => {
    if (!isAdmin && !isModerator) return;
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await removeMember(id, uid);
      setMembers(await listMembers(id));
    } catch (e) {
      console.error('Failed to remove member:', e);
      alert('Failed to remove member. You might not have permission. Please ensure your Firestore rules allow admins/moderators to manage members.');
    }
  };

  // Note: Campaign deletion is handled within CampaignDetail for owners/admins/moderators.

  const onEditBannerChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditBanner(f);
  };

  const saveGroup = async () => {
    setSavingGroup(true);
    try {
      await updateGroup(id, { name: editName, description: editDesc, bannerFile: editBanner });
      const g = await getGroup(id);
      setGroup(g);
      setShowEdit(false);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this group? This cannot be undone.')) return;
    try {
      setSavingGroup(true);
      await softDeleteGroup(id);
      alert('Group deleted');
      window.location.href = '/group';
    } catch (e) {
      alert('Failed to delete group: ' + (e?.message || e));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async () => {
    if (!window.confirm('Delete this group for everyone? This is a soft delete and can be reversed in the database.')) return;
    await softDeleteGroup(id);
    window.location.href = '/group';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <div className="card p-8 text-center">Group not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto animate-fade-in">
        {/* Banner */}
        <div className="h-32 sm:h-48 w-full relative animate-slide-in-up" style={{ backgroundColor: 'var(--card-bg)' }}>
          {group.bannerUrl ? (
            <img src={group.bannerUrl} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-themed-secondary text-sm sm:text-base">No banner</div>
          )}
        </div>

        {/* Header (below banner) - Mobile optimized */}
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-themed">{group.name}</h1>
            {/* Role pill */}
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isAdmin
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : isModerator
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : isMember
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {isAdmin ? 'Admin' : isModerator ? 'Moderator' : isMember ? 'Member' : 'Guest'}
            </span>
          </div>
          {group.description && (
            <p className="text-themed-muted mt-1 text-sm sm:text-base">{group.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {!isMember ? (
              <button onClick={handleJoin} className="px-3 sm:px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base transition-all duration-300 hover:shadow-lg active:scale-95">Join</button>
            ) : isAdmin ? (
              <>
                <button onClick={handleDeleteGroup} disabled={savingGroup} className="px-3 sm:px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm sm:text-base transition-all duration-300 hover:shadow-lg active:scale-95">{savingGroup ? 'Deleting…' : 'Delete Group'}</button>
                <span className="text-xs sm:text-sm text-themed-muted">Admins cannot leave their own group.</span>
              </>
            ) : (
              <button onClick={handleLeave} className="px-3 sm:px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm sm:text-base transition-all duration-300 hover:shadow-lg active:scale-95">Leave Group</button>
            )}
            {isAdmin && (
              <button
                onClick={()=> { setShowEdit(true); setEditName(group.name || ''); setEditDesc(group.description || ''); }}
                className="px-3 sm:px-4 py-2 rounded-full flex items-center gap-1 text-sm sm:text-base transition-all duration-300 hover:shadow-lg active:scale-95"
                style={{ backgroundColor: 'var(--hover-bg)' }}
              >
                <EditIcon fontSize="small" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="sticky top-[73px] z-30 surface border-b border-surface lg:hidden">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium transition-all ${
                activeTab === 'feed'
                  ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600'
                  : 'text-themed-secondary'
              }`}
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium transition-all ${
                activeTab === 'members'
                  ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600'
                  : 'text-themed-secondary'
              }`}
            >
              Members ({members.length})
            </button>
            {(isAdmin || isModerator) && pendingPosts.length > 0 && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium transition-all relative ${
                  activeTab === 'pending'
                    ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600'
                    : 'text-themed-secondary'
                }`}
              >
                Pending
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-red-500 rounded-full">
                  {pendingPosts.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Content Grid - Desktop keeps 2-col, Mobile uses tabs */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 p-3 sm:p-4">
          {/* Feed - Always visible on desktop, tab-controlled on mobile */}
          <div className={`lg:col-span-2 space-y-4 ${activeTab !== 'feed' ? 'hidden lg:block' : ''}`}>
            {isMember && (
              <div className="card p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-themed mb-1 text-sm sm:text-base">Create a Campaign for this Group</h3>
                  <p className="text-xs sm:text-sm text-themed-secondary">Group campaigns have community posts, likes, shares, and full donation support.</p>
                </div>
                <Link to={`/create-post?groupId=${id}`} className="w-full sm:w-auto text-center px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap transition-all duration-300 hover:shadow-lg active:scale-95">Create Campaign</Link>
              </div>
            )}
            {/* Group Campaigns (as homepage cards) */}
            <div className="space-y-3">
              {groupCampaigns.length === 0 ? (
                <div className="card p-4 sm:p-6 text-themed-muted text-sm sm:text-base">No group campaigns yet</div>
              ) : (
                groupCampaigns.map(c => (
                  <PostCard key={c.id} post={{ ...c, id: c.id }} />
                ))
              )}
            </div>

            {/* Posts */}
            {posts.length === 0 ? (
              <div className="card p-4 sm:p-6 text-themed-muted text-sm sm:text-base">No posts yet</div>
            ) : (
              <div className="space-y-3">
                {posts.map(p => (
                  <GroupItemCard key={p.id} item={{ ...p, type: 'post', groupId: id }} />
                ))}
              </div>
            )}
          </div>

          {/* Members Sidebar - Desktop always visible, Mobile tab-controlled */}
          <div className={`space-y-4 ${activeTab !== 'members' ? 'hidden lg:block' : ''}`}>
            <div className="card p-3 sm:p-4">
              <h3 className="font-semibold text-themed mb-3 text-sm sm:text-base">Members</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {members.map(m => {
                  const memberUserId = m.userId || m.id; // Support legacy docs where doc ID != userId
                  return (
                  <div key={memberUserId} className="flex items-center justify-between px-2 py-2 rounded-lg" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                        {m.photoURL ? (
                          <img src={m.photoURL} alt={m.displayName || m.id} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <PersonIcon className="text-gray-500" fontSize="small" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-themed truncate">{m.displayName || memberUserId}</p>
                        <p className="text-xs text-themed-muted">{m.role}</p>
                      </div>
                    </div>
                    {(isAdmin || isModerator) && currentUser?.uid !== memberUserId && (
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <RoleSelect value={m.role} onChange={(role)=> changeRole(memberUserId, role)} disabled={!isAdmin && m.role === 'admin'} />
                        <button onClick={()=> kickMember(memberUserId)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs transition-all duration-300 active:scale-95">Remove</button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>
          </div>

          {/* Pending Posts - Desktop shows in feed column, Mobile has dedicated tab */}
          {(isAdmin || isModerator) && pendingPosts.length > 0 && (
            <div className={`lg:col-span-2 card p-3 sm:p-4 ${activeTab === 'pending' ? 'block' : 'hidden lg:block'} ${activeTab === 'feed' ? 'lg:block' : 'lg:hidden'}`}>
              <h3 className="font-semibold text-themed mb-3 text-sm sm:text-base">Pending posts ({pendingPosts.length})</h3>
              <div className="space-y-3">
                {pendingPosts.map(p => (
                  <div key={p.id} className="p-3 rounded-lg border border-outline-variant">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="text-xs sm:text-sm text-themed">{p.authorName || 'Member'}</div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={()=> approvePost(p.id)} className="flex-1 sm:flex-none px-3 py-1 rounded bg-green-600 text-white text-xs sm:text-sm transition-all duration-300 hover:shadow-lg active:scale-95">Approve</button>
                        <button onClick={()=> rejectPost(p.id)} className="flex-1 sm:flex-none px-3 py-1 rounded bg-red-600 text-white text-xs sm:text-sm transition-all duration-300 hover:shadow-lg active:scale-95">Reject</button>
                      </div>
                    </div>
                    {p.content && <p className="text-xs sm:text-sm text-themed mt-2">{p.content}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Group Modal */}
      {showEdit && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h3 className="font-semibold text-themed">Edit group</h3>
              <button onClick={()=> setShowEdit(false)} className="p-1 rounded-full" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e)=> e.currentTarget.style.backgroundColor='var(--hover-bg)'} onMouseLeave={(e)=> e.currentTarget.style.backgroundColor='transparent'}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-themed-muted">Name</label>
                <input value={editName} onChange={(e)=> setEditName(e.target.value)} className="input-field w-full"/>
              </div>
              <div>
                <label className="text-sm text-themed-muted">Description</label>
                <textarea value={editDesc} onChange={(e)=> setEditDesc(e.target.value)} className="input-field w-full min-h-[100px]"/>
              </div>
              <div>
                <label htmlFor="edit-banner" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--hover-bg)' }}>
                  <ImageIcon fontSize="small"/> Change banner
                </label>
                <input id="edit-banner" type="file" accept="image/*" className="hidden" onChange={onEditBannerChange}/>
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={deleteGroup} className="px-4 py-2 rounded-lg bg-red-600 text-white">Delete group</button>
                <div className="flex gap-2">
                  <button onClick={()=> setShowEdit(false)} className="px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--hover-bg)' }}>Cancel</button>
                  <button onClick={saveGroup} disabled={savingGroup} className="px-4 py-2 rounded-lg bg-green-600 text-white">{savingGroup ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GroupDetail;
