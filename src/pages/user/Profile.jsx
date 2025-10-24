import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BarChartIcon from '@mui/icons-material/BarChart';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HandshakeIcon from '@mui/icons-material/Handshake';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LanguageIcon from '@mui/icons-material/Language';
import WcIcon from '@mui/icons-material/Wc';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';

const Profile = () => {
  const { currentUser, userProfile: currentUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams(); // Get userId from URL if viewing another user's profile
  const [viewedUserProfile, setViewedUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [donations, setDonations] = useState([]);
  const [receivedDonations, setReceivedDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [receivedLoading, setReceivedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal', 'posts', 'donations', 'received'
  const [donationFilter, setDonationFilter] = useState('all'); // 'all', '7days', '30days'
  const [receivedFilter, setReceivedFilter] = useState('all'); // 'all', '7days', '30days'

  // Determine if viewing own profile or another user's profile
  const isOwnProfile = !userId || userId === currentUser?.uid;
  const profileUserId = isOwnProfile ? currentUser?.uid : userId;
  const userProfile = isOwnProfile ? currentUserProfile : viewedUserProfile;

  useEffect(() => {
    if (profileUserId) {
      if (!isOwnProfile) {
        fetchViewedUserProfile();
      }
      fetchUserPosts();
      fetchDonationHistory();
      fetchReceivedHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, userId]);

  const fetchViewedUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setViewedUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const q = query(
        collection(db, 'posts'),
        where('authorId', '==', profileUserId),
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

  const fetchDonationHistory = async () => {
    try {
      setDonationsLoading(true);
      const q = query(
        collection(db, 'transactions'),
        where('donorId', '==', profileUserId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const donationData = await Promise.all(
        querySnapshot.docs.map(async (donationDoc) => {
          const donation = donationDoc.data();
          
          // Fetch campaign details
          let campaignTitle = 'Unknown Campaign';
          let recipientName = 'Unknown';
          let recipientPhoto = null;
          
          if (donation.campaignId) {
            try {
              const campaignDoc = await getDocs(query(collection(db, 'posts'), where('__name__', '==', donation.campaignId)));
              if (!campaignDoc.empty) {
                const campaign = campaignDoc.docs[0].data();
                campaignTitle = campaign.title || 'Unknown Campaign';
              }
            } catch (err) {
              console.error('Error fetching campaign:', err);
            }
          }
          
          // Fetch recipient details
          if (donation.recipientId) {
            try {
              const recipientDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', donation.recipientId)));
              if (!recipientDoc.empty) {
                const recipient = recipientDoc.docs[0].data();
                recipientName = recipient.displayName || recipient.email || 'Unknown';
                recipientPhoto = recipient.photoURL || null;
              }
            } catch (err) {
              console.error('Error fetching recipient:', err);
            }
          }
          
          return {
            id: donationDoc.id,
            ...donation,
            campaignTitle,
            recipientName,
            recipientPhoto
          };
        })
      );
      
      setDonations(donationData);
    } catch (error) {
      console.error('Error fetching donation history:', error);
    } finally {
      setDonationsLoading(false);
    }
  };

  const fetchReceivedHistory = async () => {
    try {
      setReceivedLoading(true);
      const q = query(
        collection(db, 'transactions'),
        where('recipientId', '==', profileUserId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const receivedData = await Promise.all(
        querySnapshot.docs.map(async (donationDoc) => {
          const donation = donationDoc.data();
          
          // Fetch campaign details
          let campaignTitle = 'Unknown Campaign';
          if (donation.campaignId) {
            try {
              const campaignDoc = await getDocs(query(collection(db, 'posts'), where('__name__', '==', donation.campaignId)));
              if (!campaignDoc.empty) {
                const campaign = campaignDoc.docs[0].data();
                campaignTitle = campaign.title || 'Unknown Campaign';
              }
            } catch (err) {
              console.error('Error fetching campaign:', err);
            }
          }
          
          // Fetch donor details
          let donorName = 'Anonymous';
          let donorPhoto = null;
          if (donation.donorId) {
            try {
              const donorDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', donation.donorId)));
              if (!donorDoc.empty) {
                const donor = donorDoc.docs[0].data();
                donorName = donor.displayName || donor.email || 'Anonymous';
                donorPhoto = donor.photoURL || null;
              }
            } catch (err) {
              console.error('Error fetching donor:', err);
            }
          }
          
          return {
            id: donationDoc.id,
            ...donation,
            campaignTitle,
            donorName,
            donorPhoto
          };
        })
      );
      
      setReceivedDonations(receivedData);
    } catch (error) {
      console.error('Error fetching received history:', error);
    } finally {
      setReceivedLoading(false);
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const handleDeleteCampaign = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'posts', postId));
        setUserPosts(userPosts.filter(post => post.id !== postId));
        alert('Campaign deleted successfully');
      } catch (error) {
        console.error('Error deleting campaign:', error);
        alert('Failed to delete campaign. Please try again.');
      }
    }
  };

  const handleEditCampaign = (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/edit-campaign/${postId}`);
  };

  const handleViewStats = (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/campaign-stats/${postId}`);
  };

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  // Calculate user stats
  const helpedCount = userProfile?.helpedPeople || 0;
  const joinDate = userProfile?.createdAt?.toDate ? 
    new Date(userProfile.createdAt.toDate()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 
    'October 2025';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4">
        {/* Profile Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-6">
            {/* Profile Picture */}
            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
              {(userProfile?.photoURL || currentUser?.photoURL) ? (
                <img
                  src={userProfile?.photoURL || currentUser?.photoURL}
                  alt={currentUser?.displayName || 'Profile Avatar'}
                  className="w-32 h-32 rounded-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <PersonIcon sx={{ fontSize: 64 }} className="text-gray-400" />
              )}
            </div>

            {/* Profile Name and Title */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                  {isOwnProfile 
                    ? (userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Anonymous User')
                    : (userProfile?.displayName || userProfile?.email || 'Anonymous User')
                  }
                </h1>
                {isOwnProfile && (
                  <button
                    onClick={handleEditProfile}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                    title="Edit Profile"
                  >
                    <EditIcon className="text-gray-600 dark:text-gray-400" style={{ fontSize: '20px' }} />
                  </button>
                )}
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {userProfile?.title || userProfile?.bio || 'username'}
              </p>
            </div>
          </div>

          {/* Action Buttons - Only show for own profile */}
          {isOwnProfile && (
            <div className="mt-6 flex flex-wrap gap-3 md:gap-4 justify-center md:justify-start">
              {/* Create Campaign Button */}
              <Link
                to="/create-post"
                className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full transition-all duration-300 active:scale-95"
                style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text)' }}
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'rgba(103,80,164,0.15)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
              >
                <AddIcon />
                <span className="font-medium">Create Campaign</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
              >
                <LogoutIcon />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="card mb-6">
          <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 overflow-x-auto" role="tablist" aria-label="Profile sections">
            <button
              onClick={() => setActiveTab('personal')}
              className={`relative px-4 sm:px-6 py-3 font-medium whitespace-nowrap transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 hover:[background-color:var(--hover-bg)] ${
                activeTab === 'personal'
                  ? 'text-green-700 dark:text-green-400 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-green-600 dark:after:bg-green-500'
                  : 'text-themed-secondary'
              }`}
              role="tab"
              aria-selected={activeTab === 'personal'}
            >
              Personal Info
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`relative px-4 sm:px-6 py-3 font-medium whitespace-nowrap transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 hover:[background-color:var(--hover-bg)] ${
                activeTab === 'posts'
                  ? 'text-green-700 dark:text-green-400 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-green-600 dark:after:bg-green-500'
                  : 'text-themed-secondary'
              }`}
              role="tab"
              aria-selected={activeTab === 'posts'}
            >
              Posts
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('donations')}
                className={`relative px-4 sm:px-6 py-3 font-medium whitespace-nowrap transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 hover:[background-color:var(--hover-bg)] ${
                  activeTab === 'donations'
                    ? 'text-green-700 dark:text-green-400 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-green-600 dark:after:bg-green-500'
                    : 'text-themed-secondary'
                }`}
                role="tab"
                aria-selected={activeTab === 'donations'}
              >
                Donation History
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('received')}
                className={`relative px-4 sm:px-6 py-3 font-medium whitespace-nowrap transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 hover:[background-color:var(--hover-bg)] ${
                  activeTab === 'received'
                    ? 'text-green-700 dark:text-green-400 after:content-[""] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-green-600 dark:after:bg-green-500'
                    : 'text-themed-secondary'
                }`}
                role="tab"
                aria-selected={activeTab === 'received'}
              >
                Received History
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area with Sidebar */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Stats */}
          <div className="lg:col-span-1">
            <div className="card p-6 space-y-4">
              {/* Donated Stat */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <VolunteerActivismIcon className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Donated</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(userProfile?.totalDonated || 0)}
                  </p>
                </div>
              </div>

              {/* Received Stat */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FavoriteIcon className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Received</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(userProfile?.totalReceived || 0)}
                  </p>
                </div>
              </div>

              {/* Helped Stat */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <HandshakeIcon className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Helped</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {helpedCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Personal Info Tab */}
            {activeTab === 'personal' && (
              <div className="card p-6">
                <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>
                  {userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Anonymous User'}
                </h2>
                
                <div className="space-y-4">
                  {/* Age & Gender */}
                  <div className="flex items-center gap-3">
                    <WcIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Age & Gender</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.age || ''} • {userProfile?.gender || ''}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-3">
                    <LocationOnIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.location || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-3">
                    <EmailIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.email || 'youremail@gmail.com'}
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.phone || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Bio/Description */}
                  <div className="flex items-start gap-3">
                    <PersonIcon className="text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">About</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.bio || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Website */}
                  <div className="flex items-center gap-3">
                    <LanguageIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Website</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {userProfile?.website || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Joined Date */}
                  <div className="flex items-center gap-3">
                    <CalendarTodayIcon className="text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Joined on</p>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>
                        {joinDate}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div>
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
                    <p className="text-themed-secondary text-lg mb-4">
                      You haven't created any campaigns yet
                    </p>
                    <Link to="/create-post" className="btn-primary inline-block">
                      Create Your First Campaign
                    </Link>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="card p-6 hover:shadow-lg transition-shadow relative cursor-pointer"
                    >
                      {/* Management Actions - Only show for own profile */}
                      {isOwnProfile && (
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewStats(e, post.id);
                            }}
                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md"
                            title="View Statistics"
                          >
                            <BarChartIcon style={{ fontSize: '20px' }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCampaign(e, post.id);
                            }}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md"
                            title="Edit Campaign"
                          >
                            <EditIcon style={{ fontSize: '20px' }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCampaign(e, post.id);
                            }}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md"
                            title="Delete Campaign"
                          >
                            <DeleteIcon style={{ fontSize: '20px' }} />
                          </button>
                        </div>
                      )}

                      <div>
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

                        <h3 className="text-xl font-bold text-themed mb-2">
                          {post.title}
                        </h3>
                        
                        <p className="text-themed-secondary mb-4 line-clamp-2">
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
                          <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${Math.min(calculateProgress(post.currentAmount || 0, post.goalAmount), 100)}%` }}
                            />
                          </div>
                        </div>

                        <p className="text-sm text-themed-secondary">
                          {post.supporters || 0} supporters
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Donations Tab */}
            {activeTab === 'donations' && (
              <div className="card p-6">
                {/* Filter Buttons */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setDonationFilter('all')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      donationFilter === 'all' ? 'pill-active' : 'pill'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDonationFilter('7days')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      donationFilter === '7days' ? 'pill-active' : 'pill'
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => setDonationFilter('30days')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      donationFilter === '30days' ? 'pill-active' : 'pill'
                    }`}
                  >
                    Last 30 days
                  </button>
                </div>

                {/* Table */}
                {donationsLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading donations...</p>
                  </div>
                ) : donations.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-themed-secondary">
                      No donation history found
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Recipient
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Campaign Title
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Amount
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {donations
                          .filter((donation) => {
                            if (donationFilter === 'all') return true;
                            const donationDate = donation.createdAt?.toDate ? donation.createdAt.toDate() : new Date(donation.createdAt);
                            const now = new Date();
                            const daysDiff = Math.floor((now - donationDate) / (1000 * 60 * 60 * 24));
                            
                            if (donationFilter === '7days') return daysDiff <= 7;
                            if (donationFilter === '30days') return daysDiff <= 30;
                            return true;
                          })
                          .map((donation) => {
                            const donationDate = donation.createdAt?.toDate 
                              ? donation.createdAt.toDate() 
                              : new Date(donation.createdAt);
                            
                            return (
                              <tr 
                                key={donation.id} 
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                              >
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                      {donation.recipientPhoto ? (
                                        <img
                                          src={donation.recipientPhoto}
                                          alt={donation.recipientName}
                                          className="w-10 h-10 rounded-full object-cover"
                                        />
                                      ) : (
                                        <PersonIcon className="text-gray-400" />
                                      )}
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--text)' }}>
                                      {donation.recipientName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <span style={{ color: 'var(--text)' }}>
                                    {donation.campaignTitle}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="font-semibold text-green-600 dark:text-green-400">
                                    {formatCurrency(donation.amount || 0)}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {donationDate.toLocaleDateString('en-US', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Received History Tab */}
            {activeTab === 'received' && (
              <div className="card p-6">
                {/* Filter Buttons */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setReceivedFilter('all')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      receivedFilter === 'all' ? 'pill-active' : 'pill'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setReceivedFilter('7days')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      receivedFilter === '7days' ? 'pill-active' : 'pill'
                    }`}
                  >
                    Last 7 days
                  </button>
                  <button
                    onClick={() => setReceivedFilter('30days')}
                    className={`px-4 py-2 rounded-full font-medium transition-all ${
                      receivedFilter === '30days' ? 'pill-active' : 'pill'
                    }`}
                  >
                    Last 30 days
                  </button>
                </div>

                {/* Table */}
                {receivedLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading received donations...</p>
                  </div>
                ) : receivedDonations.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-themed-secondary">
                      No received donations found
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Donor
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Campaign Title
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Amount
                          </th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivedDonations
                          .filter((donation) => {
                            if (receivedFilter === 'all') return true;
                            const donationDate = donation.createdAt?.toDate ? donation.createdAt.toDate() : new Date(donation.createdAt);
                            const now = new Date();
                            const daysDiff = Math.floor((now - donationDate) / (1000 * 60 * 60 * 24));
                            
                            if (receivedFilter === '7days') return daysDiff <= 7;
                            if (receivedFilter === '30days') return daysDiff <= 30;
                            return true;
                          })
                          .map((donation) => {
                            const donationDate = donation.createdAt?.toDate 
                              ? donation.createdAt.toDate() 
                              : new Date(donation.createdAt);
                            
                            return (
                              <tr 
                                key={donation.id} 
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                              >
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                      {donation.donorPhoto ? (
                                        <img
                                          src={donation.donorPhoto}
                                          alt={donation.donorName}
                                          className="w-10 h-10 rounded-full object-cover"
                                        />
                                      ) : (
                                        <PersonIcon className="text-gray-400" />
                                      )}
                                    </div>
                                    <span className="font-medium" style={{ color: 'var(--text)' }}>
                                      {donation.donorName}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <span style={{ color: 'var(--text)' }}>
                                    {donation.campaignTitle}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="font-semibold text-green-600 dark:text-green-400">
                                    {formatCurrency(donation.amount || 0)}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {donationDate.toLocaleDateString('en-US', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
