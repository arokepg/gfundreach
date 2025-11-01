import { useState, useEffect } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

const ExploreSection = ({ onSearchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const handleSearch = async (searchTerm) => {
    if (!searchTerm.trim()) {
      onSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      // Search posts by title or description
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const allPosts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'post'
      })).filter(p => !p.hidden);

      // Search users by display name
      const usersQuery = query(
        collection(db, 'users'),
        limit(50)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'user'
      }));

      // Filter results based on search term
      const searchLower = searchTerm.toLowerCase();
      const filteredPosts = allPosts.filter(post =>
        post.title?.toLowerCase().includes(searchLower) ||
        post.description?.toLowerCase().includes(searchLower) ||
        post.category?.toLowerCase().includes(searchLower)
      );

      const filteredUsers = allUsers.filter(user =>
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );

      onSearchResults({
        posts: filteredPosts,
        users: filteredUsers
      });

      // Add to recent searches
      if (searchTerm.trim()) {
        const newRecentSearches = [
          searchTerm,
          ...recentSearches.filter(s => s !== searchTerm)
        ].slice(0, 5);
        setRecentSearches(newRecentSearches);
        localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearchResults(null);
  };

  const deleteRecentSearch = (search) => {
    const newRecentSearches = recentSearches.filter(s => s !== search);
    setRecentSearches(newRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  return (
  <div className="card p-6 mb-6">
  <h2 className="text-xl font-bold mb-4">Explore</h2>
      
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-text)', fontSize: '20px' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Explore posts, people or causes..."
          style={{ paddingLeft: '3rem' }}
          className="w-full pr-12 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 input-field"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 transform -translate-y-1/2"
            style={{ color: 'var(--muted-text)' }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Search Button */}
      <button
        onClick={() => handleSearch(searchQuery)}
        disabled={isSearching || !searchQuery.trim()}
        className="mt-3 w-full py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
        style={{
          backgroundColor: isSearching || !searchQuery.trim() ? 'var(--surface-border)' : '#16a34a',
          color: isSearching || !searchQuery.trim() ? 'var(--muted-text)' : '#fff'
        }}
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>

      {/* Recent Searches */}
      {recentSearches.length > 0 && !searchQuery && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recent</h3>
            <button
              onClick={clearAllRecent}
              className="text-xs text-green-600 dark:text-green-400 hover:underline"
            >
              Delete all
            </button>
          </div>
          <div className="space-y-2">
            {recentSearches.map((search, index) => (
              <div
                key={index}
                className="flex items-center justify-between group"
              >
                <button
                  onClick={() => {
                    setSearchQuery(search);
                    handleSearch(search);
                  }}
                  className="flex items-center space-x-2 transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  <SearchIcon className="text-sm" style={{ color: 'var(--muted-text)' }} />
                  <span className="text-sm">{search}</span>
                </button>
                <button
                  onClick={() => deleteRecentSearch(search)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                >
                  <CloseIcon className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploreSection;
