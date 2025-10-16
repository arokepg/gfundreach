import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import RightSidebar from '../components/RightSidebar';
import FilterTabs from '../components/FilterTabs';
import PostCard from '../components/PostCard';
import NotificationDropdown from '../components/NotificationDropdown';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const postsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      setFilteredPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Filter posts based on tab
    // For now, just show all posts. You can add filtering logic here
    setFilteredPosts(posts);
  };

  return (
    <div className="min-h-screen transition-colors">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - Offset by sidebar (always use collapsed width) */}
      <div className="pl-20 transition-all">
        {/* Top Header */}
  <header className="surface border-b border-surface sticky top-0 z-40 px-6 py-4">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto">
            {/* Empty space for alignment */}
            <div></div>

            {/* Right Icons */}
            <div className="flex items-center gap-4">
              <NotificationDropdown />
              <button
                className="p-2 rounded-full transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <ChatIcon className="text-gray-700 dark:text-gray-300" />
              </button>
              <Link 
                to="/profile" 
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
              >
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <PersonIcon className="text-gray-600 dark:text-gray-300" />
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Main Layout */}
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Column - Feed */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
                  Latest posts
                </h2>
                <FilterTabs activeTab={activeTab} onTabChange={handleTabChange} />
              </div>

              {/* Posts */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading posts...</p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12 card">
                  <p className="text-gray-600 dark:text-gray-400">No posts found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="lg:col-span-1">
              <RightSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
