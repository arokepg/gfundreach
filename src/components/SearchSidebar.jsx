import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import ArticleIcon from '@mui/icons-material/Article';
import FilterListIcon from '@mui/icons-material/FilterList';
import { Link } from 'react-router-dom';
import { useSearch } from '../contexts/SearchContext';
import { useAuth } from '../contexts/AuthContext';
import { listFriendIds } from '../utils/friends';

const storeKey = 'gfr_recent_searches';
const historyKey = 'gfr_search_history';

const useDebounced = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const SectionHeader = ({ icon, title }) => (
  <div className="flex items-center gap-2 px-2 text-xs uppercase tracking-wide text-themed-muted mt-4 mb-2">
    {icon}
    <span>{title}</span>
  </div>
);

const SearchSidebar = () => {
  const { isOpen, close, query: q, setQuery } = useSearch();
  const { currentUser } = useAuth();
  const [people, setPeople] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [history, setHistory] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [friendIds, setFriendIds] = useState([]);
  
  // Advanced Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [location, setLocation] = useState('');
  const [minGoal, setMinGoal] = useState('');
  const [maxGoal, setMaxGoal] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const debounced = useDebounced(q, 300);
  const inputRef = useRef(null);

  const categories = ['Education', 'Healthcare', 'Environment', 'Community', 'Technology', 'Arts', 'Emergency', 'Other'];

  // Load recent
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setRecent(JSON.parse(raw));
    } catch (err) {
      console.warn('Failed to load recent searches:', err);
    }
    try {
      const hraw = localStorage.getItem(historyKey);
      if (hraw) setHistory(JSON.parse(hraw));
    } catch (err) {
      console.warn('Failed to load search history:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Load friend ids for current user to show Friend indicator
  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUser) { setFriendIds([]); return; }
      try {
        const ids = await listFriendIds(currentUser.uid);
        setFriendIds(ids || []);
      } catch (err) {
        console.warn('Failed to load friends:', err);
      }
    };
    if (isOpen) loadFriends();
  }, [isOpen, currentUser]);

  const saveRecent = (term) => {
    if (!term) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 8);
    setRecent(next);
    try { 
      localStorage.setItem(storeKey, JSON.stringify(next)); 
    } catch (err) {
      console.warn('Failed to save recent search:', err);
    }
  };

  const deleteRecent = (term) => {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    try { 
      localStorage.setItem(storeKey, JSON.stringify(next)); 
    } catch (err) {
      console.warn('Failed to delete recent search:', err);
    }
  };

  const clearAllRecent = () => {
    setRecent([]);
    try { 
      localStorage.removeItem(storeKey); 
    } catch (err) {
      console.warn('Failed to clear recent searches:', err);
    }
  };

  const saveHistory = (term, peopleCount = 0, campaignsCount = 0) => {
    if (!term) return;
    const entry = { term, at: new Date().toISOString(), peopleCount, campaignsCount };
    const next = [entry, ...history.filter((h) => h.term !== term)].slice(0, 20);
    setHistory(next);
    try { 
      localStorage.setItem(historyKey, JSON.stringify(next)); 
    } catch (err) {
      console.warn('Failed to save search history:', err);
    }
  };

  const deleteHistory = (at) => {
    const next = history.filter((h) => h.at !== at);
    setHistory(next);
    try { 
      localStorage.setItem(historyKey, JSON.stringify(next)); 
    } catch (err) {
      console.warn('Failed to delete history item:', err);
    }
  };

  const clearAllHistory = () => {
    setHistory([]);
    try { 
      localStorage.removeItem(historyKey); 
    } catch (err) {
      console.warn('Failed to clear search history:', err);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!debounced || debounced.trim().length < 2) {
        setPeople([]); setCampaigns([]); return;
      }
      setLoading(true);
      try {
        const raw = debounced.trim();
        const term = raw.toLowerCase();
        const isTagSearch = raw.startsWith('#');

        // People: Search by displayName, username, and email
        const usersByNameSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('displayNameLower', '>=', term),
            where('displayNameLower', '<=', term + '\uf8ff'),
            limit(5)
          )
        );
        const usersByUsernameSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('usernameLower', '>=', term),
            where('usernameLower', '<=', term + '\uf8ff'),
            limit(5)
          )
        );
        
        const usersByEmailSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('emailLower', '>=', term),
            where('emailLower', '<=', term + '\uf8ff'),
            limit(5)
          )
        );
        
        // Combine and deduplicate people results
        const peopleMap = new Map();
        [...usersByNameSnap.docs, ...usersByUsernameSnap.docs, ...usersByEmailSnap.docs].forEach((d) => {
          peopleMap.set(d.id, { id: d.id, ...d.data() });
        });
        const peopleRes = Array.from(peopleMap.values()).slice(0, 5);

        // Campaigns: Search by title, tags, and category
        const campaignsByTitleSnap = isTagSearch ? { docs: [] } : await getDocs(
          query(
            collection(db, 'posts'),
            where('titleLower', '>=', term),
            where('titleLower', '<=', term + '\uf8ff'),
            limit(10)
          )
        );
        
        const tagToken = isTagSearch ? term.replace(/^#/, '') : term;
        const campaignsByTagsSnap = await getDocs(
          query(
            collection(db, 'posts'),
            where('tagsLower', 'array-contains', tagToken),
            limit(10)
          )
        );

        // Tokenized tags search (matches any token in tagsLower)
  const tokens = (isTagSearch ? [tagToken] : term.split(/\s+/).filter(Boolean)).slice(0, 10);
        let campaignsByAnyTagsSnap = { docs: [] };
        if (tokens.length > 1) {
          campaignsByAnyTagsSnap = await getDocs(
            query(
              collection(db, 'posts'),
              where('tagsLower', 'array-contains-any', tokens),
              limit(10)
            )
          );
        }

        // Combine and deduplicate campaign results
        const campaignsMap = new Map();
        [...campaignsByTitleSnap.docs, ...campaignsByTagsSnap.docs, ...campaignsByAnyTagsSnap.docs].forEach((d) => {
          const data = d.data();
          // Filter out inactive campaigns
          if (data.campaignStatus !== 'inactive') {
            campaignsMap.set(d.id, { id: d.id, ...data });
          }
        });
        
        // Also filter by category name match
        const allCampaigns = Array.from(campaignsMap.values());
        const categoryMatches = allCampaigns.filter(c => 
          c.category?.toLowerCase().includes(term)
        );
        
        // Merge category matches
        categoryMatches.forEach(c => campaignsMap.set(c.id, c));
        
        let campaignsRes = Array.from(campaignsMap.values());

        // Apply Advanced Filters
        if (selectedCategory) {
          campaignsRes = campaignsRes.filter(c => c.category === selectedCategory);
        }
        
        if (location.trim()) {
          const loc = location.trim().toLowerCase();
          campaignsRes = campaignsRes.filter(c => 
            (c.location || '').toLowerCase().includes(loc)
          );
        }
        
        if (minGoal || maxGoal) {
          campaignsRes = campaignsRes.filter(c => {
            const goal = parseFloat(c.goalAmount) || 0;
            const min = minGoal ? parseFloat(minGoal) : 0;
            const max = maxGoal ? parseFloat(maxGoal) : Infinity;
            return goal >= min && goal <= max;
          });
        }
        
        if (selectedStatus !== 'all') {
          campaignsRes = campaignsRes.filter(c => c.campaignStatus === selectedStatus);
        }
        
        campaignsRes = campaignsRes.slice(0, 8);

        // If nothing found, apply lightweight client-side fallback contains search
        let finalPeople = peopleRes;
        let finalCampaigns = campaignsRes;

        if (finalPeople.length === 0) {
          try {
            const fallbackUsersSnap = await getDocs(query(collection(db, 'users'), limit(50)));
            const list = fallbackUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            finalPeople = list.filter(u => (
              (u.displayNameLower || u.displayName || '').toLowerCase().includes(term) ||
              (u.emailLower || u.email || '').toLowerCase().includes(term)
            )).slice(0, 5);
          } catch (err) {
            console.warn('Fallback user search failed:', err);
          }
        }

        if (finalCampaigns.length === 0) {
          try {
            const fallbackPostsSnap = await getDocs(query(collection(db, 'posts'), limit(50)));
            let list = fallbackPostsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Apply filters to fallback results
            if (selectedCategory) {
              list = list.filter(c => c.category === selectedCategory);
            }
            if (location.trim()) {
              const loc = location.trim().toLowerCase();
              list = list.filter(c => (c.location || '').toLowerCase().includes(loc));
            }
            if (minGoal || maxGoal) {
              list = list.filter(c => {
                const goal = parseFloat(c.goalAmount) || 0;
                const min = minGoal ? parseFloat(minGoal) : 0;
                const max = maxGoal ? parseFloat(maxGoal) : Infinity;
                return goal >= min && goal <= max;
              });
            }
            if (selectedStatus !== 'all') {
              list = list.filter(c => c.campaignStatus === selectedStatus);
            }
            
            finalCampaigns = list.filter(c => {
              const title = (c.titleLower || c.title || '').toLowerCase();
              const desc = (c.description || '').toLowerCase();
              const cat = (c.category || '').toLowerCase();
              const tags = Array.isArray(c.tagsLower) ? c.tagsLower : (Array.isArray(c.tags) ? c.tags.map(t=>String(t).toLowerCase()) : []);
              return (
                title.includes(term) ||
                desc.includes(term) ||
                cat.includes(term) ||
                tags.some(t => t.includes(term))
              );
            }).slice(0, 8);
          } catch (err) {
            console.warn('Fallback campaign search failed:', err);
          }
        }

        setPeople(finalPeople);
        setCampaigns(finalCampaigns);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [debounced, selectedCategory, location, minGoal, maxGoal, selectedStatus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    saveRecent(term);
    // Record a history item with the current result counts
    saveHistory(term, people.length, campaigns.length);
  };

  const handleClose = () => {
    close();
    try { document.documentElement.style.setProperty('--sidebar-width', '5rem'); } catch (e) {
      console.warn('Failed to set sidebar width:', e);
    }
  };

  // Use CSS var --sidebar-width (set by Sidebar) on desktop so we sit just to its right
  const containerCls = `fixed inset-y-0 left-(--sidebar-left) z-60 w-[320px] md:w-[380px] surface border-r border-surface transform transition-transform duration-300 ease-smooth ${
    isOpen ? 'translate-x-0' : '-translate-x-full'
  }`;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay - hidden on mobile (full screen), visible on desktop */}
      <div
        className={`hidden lg:block fixed inset-0 left-(--sidebar-left) z-55 bg-black/20 transition-opacity duration-300 opacity-100`}
        onClick={handleClose}
      />
      {/* Panel - Full screen on mobile, sidebar on desktop */}
      <aside className={`${containerCls} fixed inset-0 lg:inset-y-0 lg:right-auto lg:left-(--sidebar-left) lg:w-96`} aria-hidden={!isOpen}>
        <div className="h-[73px] border-b border-surface px-3 lg:px-3 flex items-center justify-between">
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted opacity-80 w-5 h-5" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, posts, keywords..."
                className="w-full pr-3 py-2 lg:py-2 rounded-lg input-field text-base lg:text-sm"
                style={{ paddingLeft: '3rem' }}
              />
            </div>
            <button type="button" onClick={handleClose} className="p-2 rounded-full transition-all hover:scale-110 active:scale-95 text-themed" aria-label="Close">
              <CloseIcon />
            </button>
          </form>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="border-b border-surface px-3 py-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-themed-secondary hover:text-themed transition-colors"
          >
            <FilterListIcon fontSize="small" />
            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            {(selectedCategory || location || minGoal || maxGoal || selectedStatus !== 'all') && (
              <span className="ml-auto px-2 py-0.5 text-xs bg-green-600 text-white rounded-full">Active</span>
            )}
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="border-b border-surface p-3 space-y-3 surface">
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-themed-secondary mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-field text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-xs font-medium text-themed-secondary mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State, or Country"
                className="w-full px-3 py-2 rounded-lg input-field text-sm"
              />
            </div>

            {/* Goal Amount Range */}
            <div>
              <label className="block text-xs font-medium text-themed-secondary mb-1">Goal Amount</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minGoal}
                  onChange={(e) => setMinGoal(e.target.value)}
                  placeholder="Min"
                  className="w-1/2 px-3 py-2 rounded-lg input-field text-sm"
                />
                <input
                  type="number"
                  value={maxGoal}
                  onChange={(e) => setMaxGoal(e.target.value)}
                  placeholder="Max"
                  className="w-1/2 px-3 py-2 rounded-lg input-field text-sm"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-themed-secondary mb-1">Campaign Status</label>
              <div className="flex flex-wrap gap-2">
                {['all', 'active', 'completed', 'paused'].map(status => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedStatus === status
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-200 text-themed-secondary hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters Button */}
            {(selectedCategory || location || minGoal || maxGoal || selectedStatus !== 'all') && (
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setLocation('');
                  setMinGoal('');
                  setMaxGoal('');
                  setSelectedStatus('all');
                }}
                className="w-full px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        <div className={`overflow-y-auto p-3 lg:p-3 ${showFilters ? 'h-[calc(100%-73px-48px-320px)]' : 'h-[calc(100%-73px-48px)]'}`}>
          {!q && (recent.length > 0 || history.length > 0) && (
            <div>
              {recent.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-2">
                    <SectionHeader icon={<SearchIcon fontSize="small" />} title="Recent" />
                    <button onClick={clearAllRecent} className="text-xs text-themed-muted hover:text-error transition-colors" aria-label="Clear all recent">Clear all</button>
                  </div>
                  <div className="flex flex-wrap gap-2 px-2">
                    {recent.map((r) => (
                      <div key={r} className="flex items-center gap-1 px-3 py-1.5 lg:py-1 rounded-full pill text-sm">
                        <button className="text-themed truncate max-w-[180px]" title={r} onClick={() => setQuery(r)}>{r}</button>
                        <button className="ml-1 text-themed-muted hover:text-error transition" aria-label={`Delete ${r}`} onClick={() => deleteRecent(r)}>
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between px-2">
                    <SectionHeader icon={<HistoryIcon fontSize="small" />} title="History" />
                    <button onClick={clearAllHistory} className="text-xs text-themed-muted hover:text-error transition-colors" aria-label="Clear all history">Clear all</button>
                  </div>
                  <div className="space-y-1">
                    {history.map((h) => (
                      <div key={h.at} className="flex items-center justify-between px-2 py-2.5 lg:py-2 rounded-lg hover:bg-(--hover-bg) transition">
                        <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setQuery(h.term)} title={new Date(h.at).toLocaleString()}>
                          <SearchIcon className="text-themed-muted" sx={{ fontSize: 18 }} />
                          <div className="min-w-0">
                            <div className="font-medium truncate text-themed text-sm lg:text-sm">{h.term}</div>
                            <div className="text-xs text-themed-muted truncate">{h.peopleCount || 0} people • {h.campaignsCount || 0} campaigns</div>
                          </div>
                        </button>
                        <button className="p-2 rounded-lg text-themed-muted hover:text-error transition-colors" aria-label={`Delete ${h.term}`} onClick={() => deleteHistory(h.at)}>
                          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <SectionHeader icon={<PersonAddAltIcon fontSize="small" />} title="People" />
          <div className="space-y-2">
            {loading && <div className="px-2 text-sm text-themed-muted">Searching…</div>}
            {!loading && people.length === 0 && q && (
              <div className="px-2 text-sm text-themed-muted">No people found</div>
            )}
            {people.map((u) => (
              <Link 
                key={u.uid || u.id} 
                to={`/profile/${u.uid || u.id}`} 
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-(--hover-bg) transition"
                onClick={() => { const term = q.trim(); saveRecent(term); saveHistory(term, people.length, campaigns.length); }}
              >
                <img src={u.photoURL || ''} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-200 dark:bg-gray-700" referrerPolicy="no-referrer" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-themed flex items-center gap-2">
                    <span className="truncate">{u.displayName || 'User'}</span>
                    {currentUser && (u.uid || u.id) !== currentUser.uid && friendIds.includes(u.uid || u.id) && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-semibold shrink-0">Friend</span>
                    )}
                  </div>
                  <div className="text-xs text-themed-muted truncate">{u.email}</div>
                </div>
              </Link>
            ))}
          </div>

          <SectionHeader icon={<ArticleIcon fontSize="small" />} title="Campaigns" />
          <div className="space-y-2">
            {!loading && campaigns.length === 0 && q && (
              <div className="px-2 text-sm text-themed-muted">No campaigns found</div>
            )}
            {campaigns.map((c) => (
              <Link 
                key={c.id} 
                to={`/post/${c.id}`} 
                className="block px-2 py-2 rounded-lg hover:bg-(--hover-bg) transition"
                onClick={() => { const term = q.trim(); saveRecent(term); saveHistory(term, people.length, campaigns.length); }}
              >
                <div className="flex items-start gap-2">
                  {c.imageUrl && (
                    <img 
                      src={c.imageUrl} 
                      alt="" 
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium line-clamp-1 text-themed">{c.title}</div>
                    <div className="text-xs text-themed-muted line-clamp-2">{c.shortSummary || c.description}</div>
                    {c.category && (
                      <div className="text-xs text-primary mt-1">#{c.category}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default SearchSidebar;
