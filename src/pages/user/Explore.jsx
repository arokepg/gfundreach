import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import ExploreSection from '../../components/ExploreSection';
import PostCard from '../../components/PostCard';
import FilterTabs from '../../components/FilterTabs';

const Explore = () => {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchResults, setSearchResults] = useState(null);

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

  const handleSearchResults = (results) => {
    setSearchResults(results);
    if (results && results.posts) {
      setFilteredPosts(results.posts);
    } else {
      setFilteredPosts(posts);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilteredPosts(posts);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Explore/Search */}
          <div>
            <ExploreSection onSearchResults={handleSearchResults} />
          </div>

          {/* Right Column - Results */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {searchResults ? 'Search Results' : 'All Posts'}
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
        </div>
      </div>
    </Layout>
  );
};

export default Explore;
