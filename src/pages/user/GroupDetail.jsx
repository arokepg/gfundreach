import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { createGroupPost, getGroup, getMember, joinGroup, leaveGroup, listGroupPosts, listPendingGroupPosts, listMembers, setMemberRole, approveGroupPost, rejectGroupPost, updateGroup, softDeleteGroup } from '../../utils/groups';
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
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [members, setMembers] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBanner, setEditBanner] = useState(null);
  const [savingGroup, setSavingGroup] = useState(false);

  const isAdmin = useMemo(() => member?.role === 'admin', [member]);
  const isModerator = useMemo(() => member?.role === 'moderator', [member]);
  const isMember = useMemo(() => !!member, [member]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const g = await getGroup(id);
      setGroup(g);
      if (currentUser) {
        const m = await getMember(id, currentUser.uid);
        setMember(m);
      }
      const lst = await listGroupPosts(id);
      setPosts(lst);
      const pend = await listPendingGroupPosts(id);
      setPendingPosts(pend);
      const mem = await listMembers(id);
      setMembers(mem);
      setLoading(false);
    })();
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

  const handlePost = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please log in to post');
    if (!content.trim() && !image) return;
    setPosting(true);
    try {
      await createGroupPost(id, currentUser, { content, imageFile: image });
      setContent('');
      setImage(null);
      setImagePreview(null);
      const lst = await listGroupPosts(id);
      setPosts(lst);
    } finally {
      setPosting(false);
    }
  };

  const onImageChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    const r = new FileReader();
    r.onloadend = () => setImagePreview(r.result);
    r.readAsDataURL(f);
  };

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
              <button onClick={handleLeave} className="px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--hover-bg)' }}>Leave</button>
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
            {isMember && (
              <div className="card p-4">
                <h3 className="font-semibold text-themed mb-2">Create a post</h3>
                <form onSubmit={handlePost} className="space-y-3">
                  <textarea
                    className="input-field w-full min-h-[80px]"
                    placeholder={`Share something in ${group.name}...`}
                    value={content}
                    onChange={(e)=> setContent(e.target.value)}
                  />

                  {imagePreview && (
                    <div className="relative inline-block">
                      <img src={imagePreview} alt="preview" className="w-48 h-48 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={()=> { setImage(null); setImagePreview(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <input type="file" id="group-image" className="hidden" accept="image/*" onChange={onImageChange} />
                      <label htmlFor="group-image" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--hover-bg)' }}>
                        <ImageIcon fontSize="small" /> Add image
                      </label>
                    </div>
                    <button disabled={!content.trim() && !image || posting} className="btn-primary px-6">{posting ? 'Posting...' : 'Post'}</button>
                  </div>
                </form>
              </div>
            )}

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
                      <RoleSelect value={m.role} onChange={(role)=> changeRole(m.id, role)} disabled={!isAdmin && m.role === 'admin'} />
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
