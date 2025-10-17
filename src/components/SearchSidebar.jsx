import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import ArticleIcon from '@mui/icons-material/Article';
import { Link } from 'react-router-dom';
import { useSearch } from '../contexts/SearchContext';

const storeKey = 'gfr_recent_searches';

const useDebounced = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const SectionHeader = ({ icon, title }) => (
  <div className="flex items-center gap-2 px-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-4 mb-2">
    {icon}
    <span>{title}</span>
  </div>
);

const SearchSidebar = () => {
  const { isOpen, close, query: q, setQuery } = useSearch();
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const debounced = useDebounced(q, 300);
  const inputRef = useRef(null);

  // Load recent
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const saveRecent = (term) => {
    if (!term) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {}
  };

  useEffect(() => {
    const run = async () => {
      if (!debounced || debounced.trim().length < 2) {
        setPeople([]); setPosts([]); return;
      }
      setLoading(true);
      try {
        const term = debounced.trim().toLowerCase();

        // People: case-insensitive prefix search on precomputed field
        const usersSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('displayNameLower', '>=', term),
            where('displayNameLower', '<=', term + '\\uf8ff'),
            limit(5)
          )
        );
        const peopleRes = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Posts: case-insensitive prefix search on precomputed titleLower field
        const postsSnap = await getDocs(
          query(
            collection(db, 'posts'),
            where('titleLower', '>=', term),
            where('titleLower', '<=', term + '\\uf8ff'),
            limit(5)
          )
        );
        const postsRes = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setPeople(peopleRes);
        setPosts(postsRes);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const handleSubmit = (e) => {
    e.preventDefault();
    saveRecent(q.trim());
  };

  const handleClose = () => {
    close();
    try { document.documentElement.style.setProperty('--sidebar-width', '5rem'); } catch {}
  };

  // Use CSS var --sidebar-width (set by Sidebar) on desktop so we sit just to its right
  const containerCls = `fixed inset-y-0 left-[var(--sidebar-left)] z-[60] w-[320px] md:w-[380px] surface border-r border-surface transform transition-transform duration-300 ease-smooth ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 left-[var(--sidebar-left)] z-[55] bg-black/20 transition-opacity duration-300 opacity-100`}
        onClick={handleClose}
      />
      {/* Panel */}
      <aside className={containerCls} aria-hidden={!isOpen}>
        <div className="h-[73px] border-b border-surface px-3 flex items-center justify-between">
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, posts, keywords..."
                className="w-full pl-10 pr-3 py-2 rounded-lg input-field"
              />
            </div>
            <button type="button" onClick={handleClose} className="p-2 rounded-full transition-all hover:scale-110 active:scale-95" aria-label="Close">
              <CloseIcon />
            </button>
          </form>
        </div>

        <div className="overflow-y-auto h-[calc(100%-73px)] p-3">
          {!q && recent.length > 0 && (
            <div>
              <SectionHeader icon={<SearchIcon fontSize="small" />} title="Recent" />
              <div className="flex flex-wrap gap-2 px-2">
                {recent.map((r) => (
                  <button key={r} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm hover:scale-105 transition"
                    onClick={() => setQuery(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SectionHeader icon={<PersonAddAltIcon fontSize="small" />} title="People" />
          <div className="space-y-2">
            {loading && <div className="px-2 text-sm text-gray-500">Searching…</div>}
            {!loading && people.length === 0 && q && (
              <div className="px-2 text-sm text-gray-500">No people found</div>
            )}
            {people.map((u) => (
              <Link key={u.uid || u.id} to="/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <img src={u.photoURL || ''} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-200" referrerPolicy="no-referrer" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.displayName || 'User'}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>
              </Link>
            ))}
          </div>

          <SectionHeader icon={<ArticleIcon fontSize="small" />} title="Posts" />
          <div className="space-y-2">
            {!loading && posts.length === 0 && q && (
              <div className="px-2 text-sm text-gray-500">No posts found</div>
            )}
            {posts.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="block px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="font-medium line-clamp-1">{p.title}</div>
                <div className="text-xs text-gray-500 line-clamp-2">{p.description}</div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default SearchSidebar;
