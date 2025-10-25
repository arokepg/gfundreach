import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { createGroupPost, getGroup, getMember, joinGroup, leaveGroup, listGroupPosts, listPendingGroupPosts, listMembers, setMemberRole, approveGroupPost, rejectGroupPost, updateGroup, softDeleteGroup, removeMember } from '../../utils/groups';
import { collection, getDocs, orderBy, query, where, deleteDoc, doc as fsDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import PersonIcon from '@mui/icons-material/Person';
import ImageIcon from '@mui/icons-material/Image';
import EditIcon from '@mui/icons-material/Edit';

const RoleSelect = ({ value, onChange, disabled }) => (
  <select
    value={value}
    onChange={(e)=> onChange(e.target.value)}
    disabled={disabled}
    className="text-sm px-2 py-1 rounded-lg border border-outline-variant bg-transparent text-themed"
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
          if (!cancelled) setMembers(mem);
        } catch (err) {
          console.warn('Failed to list members (non-fatal):', err);
          if (!cancelled) setMembers([]);
        }

        // Fetch group campaigns (posts with groupId == id)
        try {
          const q = query(collection(db, 'posts'), where('groupId', '==', id), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          if (!cancelled) setGroupCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    await leaveGroup(id, currentUser.uid);
    setMember(null);
  };

  // Note: group feed composer removed in favor of creating campaigns; unused post composer code removed.

  const changeRole = async (uid, role) => {
    await setMemberRole(id, uid, role);
    const mem = await listMembers(id);
    setMembers(mem);
    if (uid === currentUser?.uid) {
      const m = await getMember(id, currentUser.uid);
      setMember(m);
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

  const deleteCampaign = async (campaignId) => {
    if (!isAdmin && !isModerator) return;
    if (!window.confirm('Delete this campaign from the group? This cannot be undone.')) return;
    try {
      await deleteDoc(fsDoc(db, 'posts', String(campaignId)));
      const q = query(collection(db, 'posts'), where('groupId', '==', id), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setGroupCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to delete campaign:', e);
      alert('Failed to delete campaign.');
    }
  };

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
      <div className="max-w-6xl mx-auto">
        {/* Banner */}
        <div className="h-48 w-full relative" style={{ backgroundColor: 'var(--card-bg)' }}>
          {group.bannerUrl ? (
            <img src={group.bannerUrl} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-themed-secondary">No banner</div>
          )}
        </div>

        {/* Header (below banner) */}
        <div className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-themed">{group.name}</h1>
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
            <p className="text-themed-muted mt-1">{group.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {!isMember ? (
              <button onClick={handleJoin} className="px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white">Join</button>
            ) : (
              <button onClick={handleLeave} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white">Leave Group</button>
            )}
            {isAdmin && (
              <button
                onClick={()=> { setShowEdit(true); setEditName(group.name || ''); setEditDesc(group.description || ''); }}
                className="px-4 py-2 rounded-full flex items-center gap-1"
                style={{ backgroundColor: 'var(--hover-bg)' }}
              >
                <EditIcon fontSize="small" /> Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {(isAdmin || isModerator) && (
              <div className="card p-4">
                <h3 className="font-semibold text-themed mb-2">Group Campaigns</h3>
                {groupCampaigns.length === 0 ? (
                  <div className="text-sm text-themed-muted">No group campaigns yet</div>
                ) : (
                  <div className="space-y-2">
                    {groupCampaigns.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-outline-variant">
                        <div className="min-w-0">
                          <Link to={`/post/${c.id}`} className="font-medium text-themed hover:underline truncate block">{c.title || 'Untitled'}</Link>
                          <div className="text-xs text-themed-muted truncate">{c.shortSummary || c.description?.slice(0,100) || ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/edit-campaign/${c.id}`} className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Edit</Link>
                          <button onClick={()=> deleteCampaign(c.id)} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isMember && (
              <div className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-themed mb-1">Create a Campaign for this Group</h3>
                  <p className="text-sm text-themed-secondary">Group campaigns have community posts, likes, shares, and full donation support.</p>
                </div>
                <Link to={`/create-post?groupId=${id}`} className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white">Create Campaign</Link>
              </div>
            )}

            {/* Admin/Mod Group Campaigns Management */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-themed">Group Campaigns</h3>
                {(isAdmin || isModerator) && (
                  <span className="text-xs text-themed-muted">Admin tools enabled</span>
                )}
              </div>
              {groupCampaigns.length === 0 ? (
                <div className="text-sm text-themed-muted">No group campaigns yet</div>
              ) : (
                <div className="space-y-2">
                  {groupCampaigns.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-outline-variant">
                      <div className="min-w-0">
                        <Link to={`/post/${c.id}`} className="font-medium text-themed hover:underline truncate block">{c.title || 'Untitled'}</Link>
                        <div className="text-xs text-themed-muted truncate">{c.shortSummary || c.description?.slice(0,100) || ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(isAdmin || isModerator) && (
                          <>
                            <Link to={`/edit-campaign/${c.id}`} className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Edit</Link>
                            <button onClick={()=> deleteCampaign(c.id)} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
                          </>
                        )}
                        {!(isAdmin || isModerator) && (
                          <Link to={`/post/${c.id}`} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">View</Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Posts */}
            {posts.length === 0 ? (
              <div className="card p-6 text-themed-muted">No posts yet</div>
            ) : (
              <div className="space-y-3">
                {posts.map(p => (
                  <div key={p.id} className="card p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {p.authorPhoto ? <img src={p.authorPhoto} alt="" className="w-full h-full object-cover" /> : <PersonIcon className="text-gray-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-themed text-sm">{p.authorName || 'Member'}</p>
                        {p.createdAt && (
                          <p className="text-xs text-themed-muted">{p.createdAt.toDate ? p.createdAt.toDate().toLocaleString() : new Date(p.createdAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    {p.type === 'campaign' && p.campaignId ? (
                      <Link to={`/post/${p.campaignId}`} className="block p-4 rounded-lg border border-outline-variant hover:bg-[var(--hover-bg)]">
                        <div className="text-themed">Shared a campaign → View details</div>
                      </Link>
                    ) : (
                      <>
                        <p className="text-sm text-themed mb-2 whitespace-pre-wrap">{p.content}</p>
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="rounded-lg max-h-[420px] w-full object-contain" style={{ backgroundColor: 'var(--card-bg)' }} />}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(isAdmin || isModerator) && (
              <div className="card p-4">
                <h3 className="font-semibold text-themed mb-3">Pending posts ({pendingPosts.length})</h3>
                {pendingPosts.length === 0 ? (
                  <div className="text-sm text-themed-muted">No pending posts</div>
                ) : (
                  <div className="space-y-3">
                    {pendingPosts.map(p => (
                      <div key={p.id} className="p-3 rounded-lg border border-outline-variant">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-themed">{p.authorName || 'Member'}</div>
                          <div className="flex gap-2">
                            <button onClick={()=> approvePost(p.id)} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Approve</button>
                            <button onClick={()=> rejectPost(p.id)} className="px-3 py-1 rounded bg-red-600 text-white text-sm">Reject</button>
                          </div>
                        </div>
                        {p.content && <p className="text-sm text-themed mt-2">{p.content}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold text-themed mb-3">Members</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-2 py-2 rounded-lg" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        {m.photoURL ? (
                          <img src={m.photoURL} alt={m.displayName || m.id} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <PersonIcon className="text-gray-500" fontSize="small" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-themed">{m.displayName || m.id}</p>
                        <p className="text-xs text-themed-muted">{m.role}</p>
                      </div>
                    </div>
                    {(isAdmin || isModerator) && currentUser?.uid !== m.id && (
                      <div className="flex items-center gap-2">
                        <RoleSelect value={m.role} onChange={(role)=> changeRole(m.id, role)} disabled={!isAdmin && m.role === 'admin'} />
                        <button onClick={()=> kickMember(m.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs">Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-semibold text-themed mb-3">Share a campaign</h3>
              <p className="text-sm text-themed-muted mb-3">Create campaigns as usual, then paste the campaign link here to share it to the group feed.</p>
              <ShareCampaign groupId={id} onShared={async ()=> setPosts(await listGroupPosts(id))} />
            </div>
          </div>
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

const ShareCampaign = ({ groupId, onShared }) => {
  const { currentUser } = useAuth();
  const [url, setUrl] = useState('');
  const [sharing, setSharing] = useState(false);

  const parseId = (u) => {
    try {
      // Accept /post/:id and full URL
      const m = u.match(/\/post\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : u.trim();
    } catch {
      return '';
    }
  };

  const handleShare = async () => {
    const id = parseId(url);
    if (!id) return;
    if (!currentUser) return alert('Please log in');
    setSharing(true);
    try {
      await createGroupPost(groupId, currentUser, { content: '', type: 'campaign', campaignId: id });
      setUrl('');
      onShared && onShared();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        value={url}
        onChange={(e)=> setUrl(e.target.value)}
        placeholder="Paste /post/:id link"
        className="input-field flex-1"
      />
      <button onClick={handleShare} disabled={!url.trim() || sharing} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white">{sharing ? 'Sharing...' : 'Share'}</button>
    </div>
  );
};

export default GroupDetail;
