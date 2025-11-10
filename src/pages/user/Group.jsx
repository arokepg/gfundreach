import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import GroupIcon from '@mui/icons-material/Group';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import { useAuth } from '../../contexts/AuthContext';
import { createGroup, listGroups, getMember } from '../../utils/groups';
import { useQuery } from '@tanstack/react-query';

const Group = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [roles, setRoles] = useState({}); // { [groupId]: 'admin'|'moderator'|'member' }

  // Groups query
  const groupsQuery = useQuery({
    queryKey: ['groups:list'],
    queryFn: () => listGroups(),
  });

  // Derive roles after groups load
  useEffect(() => {
    const list = groupsQuery.data || [];
    setGroups(list);
    setLoading(groupsQuery.isLoading);
    const fetchRoles = async () => {
      if (!currentUser || !list.length) return setRoles({});
      const pairs = await Promise.all(
        list.map(async (g) => {
          try {
            const m = await getMember(g.id, currentUser.uid);
            return [g.id, m?.role || null];
          } catch {
            return [g.id, null];
          }
        })
      );
      setRoles(Object.fromEntries(pairs));
    };
    fetchRoles();
  }, [groupsQuery.data, groupsQuery.isLoading, currentUser]);

  const filtered = useMemo(() => {
    if (!q.trim()) return groups;
    const s = q.toLowerCase();
    return groups.filter(g => (g.name || '').toLowerCase().includes(s));
  }, [groups, q]);

  const onBannerChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBannerFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please log in to create a group');
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = await createGroup(currentUser.uid, { name: name.trim(), description, bannerFile });
      setShowCreate(false);
      setName('');
      setDescription('');
      setBannerFile(null);
      setBannerPreview(null);
      navigate(`/group/${id}`);
    } catch (err) {
      alert('Failed to create group: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 flex flex-col lg:flex-row gap-6 animate-fade-in">
        {/* Actions sidebar (move to right on large screens) */}
  <div className="w-full lg:w-64 shrink-0 lg:order-2 animate-slide-in-up">
          <div className="card p-4">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              <AddIcon /> Create group
            </button>
          </div>
          <div className="card p-4 mt-4">
            <div className="flex items-center gap-2 text-themed">
              <GroupIcon />
              <span className="font-semibold">Your groups</span>
            </div>
            <div className="mt-3 space-y-2">
              {groups.slice(0, 5).map(g => (
                <Link key={g.id} to={`/group/${g.id}`} className="block px-3 py-2 rounded-lg hover:bg-(--hover-bg)">
                  <span className="font-medium text-themed">{g.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

  {/* Main list */}
  <div className="flex-1 lg:order-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h1 className="text-2xl font-bold text-themed">Discover groups</h1>
            <div className="flex items-center gap-2 p-2 rounded-lg w-full sm:w-auto" style={{ backgroundColor: 'var(--hover-bg)' }}>
              <SearchIcon className="text-themed-secondary" />
              <input
                value={q}
                onChange={(e)=> setQ(e.target.value)}
                placeholder="Search groups"
                className="bg-transparent outline-none text-themed w-full sm:w-auto"
              />
            </div>
          </div>

          {loading ? (
            <div className="card p-6 text-themed-muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="card p-6 text-themed-muted">No groups yet</div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filtered.map(g => {
                const role = roles[g.id];
                const rolePill = role === 'admin'
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : role === 'moderator'
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : role === 'member'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'hidden';
                return (
                  <Link key={g.id} to={`/group/${g.id}`} className="card overflow-hidden p-0 block border border-surface shadow-md hover:shadow-xl rounded-2xl transition-shadow">
                    {/* Banner on top */}
                    <div className="w-full h-40" style={{ backgroundColor: 'var(--card-bg)' }}>
                      {g.bannerUrl ? (
                        <img src={g.bannerUrl} alt={g.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-themed-secondary">No banner</div>
                      )}
                    </div>
                    {/* Info below */}
                    <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-themed text-lg truncate">{g.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${rolePill}`}>{role ? role.charAt(0).toUpperCase()+role.slice(1) : ''}</span>
                        </div>
                        {g.description && (
                          <p className="text-sm text-themed-muted mt-1 line-clamp-2">{g.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-green-700 dark:text-green-400 text-sm font-medium">View →</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h2 className="text-lg font-bold text-themed">Create group</h2>
              <button onClick={()=> setShowCreate(false)} className="p-1 rounded-full" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e)=> e.currentTarget.style.backgroundColor='var(--hover-bg)'} onMouseLeave={(e)=> e.currentTarget.style.backgroundColor='transparent'}>
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-themed">Group Banner</label>
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-500 transition-colors cursor-pointer">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon sx={{ fontSize: 48 }} />
                      <p className="mt-2 text-sm">Click to upload banner image</p>
                      <p className="mt-1 text-xs">Recommended: 1200x400px</p>
                    </div>
                  )}
                  <input id="banner-upload" type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={onBannerChange} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-themed mb-2">Group Name *</label>
                  <input
                    className="input-field w-full"
                    placeholder="Enter group name"
                    value={name}
                    onChange={(e)=> setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-themed mb-2">Description (optional)</label>
                  <textarea
                    className="input-field w-full min-h-[120px]"
                    placeholder="Describe what your group is about..."
                    value={description}
                    onChange={(e)=> setDescription(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={()=> setShowCreate(false)} className="px-4 py-2 rounded-lg text-themed" style={{ backgroundColor: 'var(--hover-bg)' }}>Cancel</button>
                  <button disabled={!name.trim() || creating} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-60">{creating ? 'Creating...' : 'Create'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Group;
