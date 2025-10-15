import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PersonIcon from '@mui/icons-material/Person';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LinearProgress from '@mui/material/LinearProgress';

const Profile = () => {
  const { currentUser, userProfile } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchUserPosts();
    }
  }, [currentUser]);

  const fetchUserPosts = async () => {
    try {
      const q = query(
        collection(db, 'posts'),
        where('authorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const posts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserPosts(posts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
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
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="card p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Profile Picture */}
            <div className="w-32 h-32 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <PersonIcon sx={{ fontSize: 64 }} className="text-primary" />
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {currentUser?.displayName || 'Anonymous User'}
              </h1>
              <p className="text-gray-600 mb-4">{currentUser?.email}</p>
              {userProfile?.bio && (
                <p className="text-gray-700 mb-4">{userProfile.bio}</p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-primary-50 rounded-xl">
                  <p className="text-2xl font-bold text-primary">
                    {userPosts.length}
                  </p>
                  <p className="text-sm text-gray-600">Campaigns</p>
                </div>
                <div className="text-center p-4 bg-secondary-50 rounded-xl">
                  <p className="text-2xl font-bold text-secondary">
                    {formatCurrency(userProfile?.totalDonated || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Donated</p>
                </div>
                <div className="text-center p-4 bg-tertiary-50 rounded-xl">
                  <p className="text-2xl font-bold text-tertiary">
                    {formatCurrency(userProfile?.totalReceived || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Received</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link to="/wallet" className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-primary-50 p-3 rounded-full">
                <AccountBalanceWalletIcon className="text-primary" sx={{ fontSize: 32 }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Wallet</h3>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(userProfile?.walletBalance || 0)}
                </p>
              </div>
            </div>
          </Link>

          <Link to="/create-post" className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-secondary-50 p-3 rounded-full">
                <VolunteerActivismIcon className="text-secondary" sx={{ fontSize: 32 }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Create Campaign</h3>
                <p className="text-gray-600">Start a new fundraiser</p>
              </div>
            </div>
          </Link>
        </div>

        {/* User's Campaigns */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Campaigns</h2>
          
          {loading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          )}

          {!loading && userPosts.length === 0 && (
            <div className="card p-12 text-center">
              <p className="text-gray-600 text-lg mb-4">
                You haven't created any campaigns yet
              </p>
              <Link to="/create-post" className="btn-primary inline-block">
                Create Your First Campaign
              </Link>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {userPosts.map((post) => (
              <Link
                key={post.id}
                to={`/post/${post.id}`}
                className="card p-6 hover:shadow-lg transition-shadow"
              >
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-48 object-cover rounded-xl mb-4"
                  />
                )}
                
                <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium mb-3">
                  {post.category}
                </span>

                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {post.title}
                </h3>
                
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {post.description}
                </p>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(post.currentAmount || 0)}
                    </span>
                    <span className="text-gray-600 text-sm">
                      of {formatCurrency(post.goalAmount)}
                    </span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={calculateProgress(post.currentAmount || 0, post.goalAmount)}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#E7E0EC',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: '#6750A4',
                      },
                    }}
                  />
                </div>

                <p className="text-sm text-gray-600">
                  {post.supporters || 0} supporters
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
