import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PersonIcon from '@mui/icons-material/Person';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatIcon from '@mui/icons-material/Chat';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const location = useLocation();
  const navigate = useNavigate();
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

  const isActivePath = (path) => location.pathname === path;

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Home' },
    { path: '/explore', icon: ExploreIcon, label: 'Explore' },
    { path: '/saved', icon: BookmarkIcon, label: 'Saved' },
    { path: '/group', icon: GroupIcon, label: 'Group' },
    { path: '/wallet', icon: AccountBalanceWalletIcon, label: 'Wallet' },
    { path: '/profile', icon: AccountCircleIcon, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-green-600 rounded-lg p-1.5">
              <VolunteerActivismIcon sx={{ color: 'white', fontSize: 28 }} />
            </div>
            <span className="text-2xl font-bold text-green-600">Gfundreach</span>
          </Link>

          {/* Right Icons */}
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <NotificationsIcon className="text-gray-700" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChatIcon className="text-gray-700" />
            </button>
            <Link to="/profile" className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <PersonIcon className="text-gray-600" />
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex max-w-[1400px] mx-auto">
        {/* Left Sidebar */}
        <aside className="w-[280px] bg-white h-[calc(100vh-73px)] sticky top-[73px] border-r border-gray-200 p-4">
          {/* Create Post Button */}
          <Link
            to="/create-post"
            className="w-full bg-black text-white rounded-full py-3 px-6 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors mb-6 font-medium"
          >
            <AddCircleOutlineIcon />
            Create Post
          </Link>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-gray-200 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={active ? 'text-gray-900' : 'text-gray-600'} />
                  <span className="text-[15px]">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Stats Card */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <PersonIcon className="text-gray-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{currentUser?.displayName || 'User'}</p>
                <p className="text-sm text-gray-500">{currentUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Donated</span>
                <span className="font-medium text-green-600">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Received</span>
                <span className="font-medium text-blue-600">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Helped :</span>
                <span className="font-medium text-gray-900">0 people</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {/* Filter Tabs */}
          <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
            <div className="flex gap-4 px-8 py-4">
              {['All', 'Friends', 'Requests', 'Offers'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`px-6 py-2 rounded-full font-medium transition-colors ${
                    activeTab === tab.toLowerCase()
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Feed */}
          <div className="px-8 py-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Latest posts</h2>

            {/* Loading State */}
            {loading && (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-gray-200">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && posts.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                <p className="text-gray-600 text-lg mb-4">
                  No fundraising posts yet
                </p>
                <Link to="/create-post" className="inline-block bg-primary text-white px-6 py-2 rounded-full hover:bg-primary-dark transition-colors">
                  Create the First Post
                </Link>
              </div>
            )}

            {/* Posts List */}
            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  {/* Post Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                        {post.authorPhoto ? (
                          <img
                            src={post.authorPhoto}
                            alt={post.authorName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <PersonIcon className="text-gray-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{post.authorName}</p>
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          <p className="text-sm text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                        Need Help
                      </span>
                      <span className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-medium">
                        High Priority
                      </span>
                    </div>
                  </div>

                  {/* Post Content */}
                  <Link to={`/post/${post.id}`} className="block">
                    <p className="text-gray-800 mb-3 leading-relaxed">
                      {post.description}
                    </p>
                    <p className="text-primary font-medium mb-3">#{post.category}</p>

                    {/* Location */}
                    {post.location && (
                      <div className="flex items-center gap-2 text-gray-600 text-sm mb-4">
                        <span>📍</span>
                        <span>{post.location}</span>
                      </div>
                    )}

                    {/* Post Image */}
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-72 object-cover rounded-xl mb-4"
                      />
                    )}

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-primary text-white rounded-full px-3 py-1 flex items-center gap-1 text-sm font-medium">
                          <span>$</span>
                          <span>{formatCurrency(post.currentAmount || 0).replace('$', '')}</span>
                        </div>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${calculateProgress(post.currentAmount || 0, post.goalAmount)}%` }}
                          />
                        </div>
                        <span className="text-gray-600 text-sm font-medium">
                          {formatCurrency(post.goalAmount)}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Post Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors">
                        <FavoriteIcon fontSize="small" />
                        <span className="text-sm font-medium">{post.supporters || 100}</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors">
                        <ChatIcon fontSize="small" />
                        <span className="text-sm font-medium">15</span>
                      </button>
                      <button className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors">
                        <span className="text-sm font-medium">🔄 2</span>
                      </button>
                    </div>
                    <Link
                      to={`/post/${post.id}`}
                      className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Help Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-[340px] bg-white h-[calc(100vh-73px)] sticky top-[73px] border-l border-gray-200 p-6 overflow-y-auto">
          {/* Top Donaters */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🏆</span>
              <h3 className="font-bold text-gray-900">Top Donaters</h3>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Tran Quoc Cuong', amount: '$100,000', helped: '1 helped', rank: 1 },
                { name: 'Tien Hai', amount: '$50,000', helped: '10 helped', rank: 2 },
                { name: 'Team Kitkat', amount: '$36,000', helped: '18 helped', rank: 3 },
              ].map((donater) => (
                <div key={donater.rank} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                    {donater.rank}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{donater.name}</p>
                    <p className="text-xs text-gray-500">
                      {donater.amount} · {donater.helped}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Categories */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📈</span>
              <h3 className="font-bold text-gray-900">Trending categories</h3>
            </div>
            <div className="space-y-2">
              {[
                { name: '#ThienAn', posts: 123, growth: '+36%' },
                { name: '#ElonMusk', posts: 107, growth: '+18%' },
                { name: '#J97', posts: 63, growth: '+9%' },
                { name: '#KhacThinh', posts: 27, growth: '+7%' },
                { name: '#KitKat', posts: 3, growth: '+6%' },
              ].map((category) => (
                <div key={category.name} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{category.name}</p>
                    <p className="text-xs text-gray-500">{category.posts} posts</p>
                  </div>
                  <span className="text-green-600 text-xs font-semibold">{category.growth}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Home;
