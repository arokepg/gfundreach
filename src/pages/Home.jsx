import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LinearProgress from '@mui/material/LinearProgress';
import PersonIcon from '@mui/icons-material/Person';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Support Those in Need
          </h1>
          <p className="text-gray-600">
            Discover fundraising campaigns and make a difference today
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {/* Posts List */}
        {!loading && posts.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-gray-600 text-lg mb-4">
              No fundraising posts yet
            </p>
            <Link to="/create-post" className="btn-primary inline-block">
              Create the First Post
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/post/${post.id}`}
              className="block card p-6 hover:shadow-lg transition-shadow"
            >
              {/* Post Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  {post.authorPhoto ? (
                    <img
                      src={post.authorPhoto}
                      alt={post.authorName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <PersonIcon className="text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{post.authorName}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-64 object-cover rounded-xl mb-4"
                />
              )}

              {/* Post Content */}
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {post.title}
              </h2>
              <p className="text-gray-600 mb-4 line-clamp-3">
                {post.description}
              </p>

              {/* Category */}
              <div className="mb-4">
                <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {post.category}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(post.currentAmount || 0)}
                  </span>
                  <span className="text-gray-600">
                    of {formatCurrency(post.goalAmount)}
                  </span>
                </div>
                <LinearProgress
                  variant="determinate"
                  value={calculateProgress(post.currentAmount || 0, post.goalAmount)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#E7E0EC',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#6750A4',
                    },
                  }}
                />
                <p className="text-sm text-gray-600 mt-2">
                  {Math.round(calculateProgress(post.currentAmount || 0, post.goalAmount))}% funded
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-1">
                  <FavoriteIcon fontSize="small" className="text-error" />
                  <span>{post.supporters || 0} supporters</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
