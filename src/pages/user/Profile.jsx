import { useState, useEffect, useMemo } from 'react';
import { formatCurrencyShort } from '../../utils/numberFormat';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, getDoc, collectionGroup, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
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
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import AddFriendButton from '../../components/AddFriendButton';
import { listFriendIds, getFriendshipStatus, acceptFriendRequest, cancelFriendRequest } from '../../utils/friends';
import { calculateWalletStats } from '../../utils/walletHelpers';

const Profile = () => {
  const { currentUser, userProfile: currentUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams(); // Get userId from URL if viewing another user's profile
  const [viewedUserProfile, setViewedUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userCommunityPosts, setUserCommunityPosts] = useState([]);
  const [donations, setDonations] = useState([]);
  const [receivedDonations, setReceivedDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [receivedLoading, setReceivedLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal', 'campaigns', 'community', 'donations', 'received', 'friends'
  const [donationFilter, setDonationFilter] = useState('all'); // 'all', '7days', '30days'
  const [receivedFilter, setReceivedFilter] = useState('all'); // 'all', '7days', '30days'
  const [friendsList, setFriendsList] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]); // received requests with user info
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [profileFriendStatus, setProfileFriendStatus] = useState(''); // status vs profileUserId
  const [acceptedAnim, setAcceptedAnim] = useState(false);
  const [friendsPrivacy, setFriendsPrivacy] = useState('public'); // 'public' or 'private'
  const location = useLocation();
  // Sub-tab state for Friends area: 'friends' or 'requests'. Default to 'friends'
  const [friendsSubTab, setFriendsSubTab] = useState('friends');
  const [walletStats, setWalletStats] = useState({ totalDonated: 0, totalReceived: 0 });

  // If navigation provides a friendsSubTab in location.state or query, open Friends tab and set the sub-tab
  useEffect(() => {
    try {
      const stateSub = location?.state?.friendsSubTab || location?.state?.friendsTab;
      const querySub = new URLSearchParams(location?.search || '').get('friendsSubTab');
      const initialSub = stateSub || querySub;
      if (initialSub) {
        setActiveTab('friends');
        setFriendsSubTab(initialSub);
      }
    } catch {
      // ignore
    }
    // Only run on mount / when location changes
  }, [location]);

  // Determine if viewing own profile or another user's profile
  const isOwnProfile = !userId || userId === currentUser?.uid;
  const profileUserId = isOwnProfile ? currentUser?.uid : userId;
  const userProfile = isOwnProfile ? currentUserProfile : viewedUserProfile;

  useEffect(() => {
    if (profileUserId) {
      if (!isOwnProfile) {
        fetchViewedUserProfile();
      } else {
        // Fetch privacy setting for own profile
        fetchPrivacySettings();
      }
      fetchUserPosts();
      fetchUserCommunityPosts();
      fetchDonationHistory();
      fetchReceivedHistory();
      // Fetch wallet stats
      calculateWalletStats(profileUserId).then(stats => {
        setWalletStats(stats);
      });
      // check friendship status against profile user (for header badge and accept/delete)
      if (currentUser?.uid && profileUserId && !isOwnProfile) {
        (async () => {
          try {
            const s = await getFriendshipStatus(currentUser.uid, profileUserId);
            setProfileFriendStatus(s.status);
          } catch {
            setProfileFriendStatus('');
          }
        })();
      } else {
        setProfileFriendStatus('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, userId]);

  const fetchPrivacySettings = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setFriendsPrivacy(data?.profilePrivacy?.friendsList || 'public');
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    }
  };

  // When viewing another user's profile, load their basic user data
  const fetchViewedUserProfile = async () => {
    try {
      if (!userId) return;
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        setViewedUserProfile({ id: userId, ...snap.data() });
      } else {
        setViewedUserProfile(null);
      }
    } catch (err) {
      console.error('Failed to load viewed user profile:', err);
      setViewedUserProfile(null);
    }
  };

  const fetchFriendsList = async () => {
    setFriendsLoading(true);
    try {
      const ids = await listFriendIds(profileUserId);
      
      // Filter out the profile owner from the IDs list immediately
      const filteredIds = ids.filter(id => id !== profileUserId);
      
      const friendsData = await Promise.all(
        filteredIds.map(async (id) => {
          // Extra safety: skip if id matches profileUserId
          if (id === profileUserId) return null;
          
          try {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              return { id, ...userDoc.data() };
            }
            // Keep a minimal placeholder entry so the friend still appears
            return { id };
          } catch {
            return { id };
          }
        })
      );
      let allFriends = friendsData.filter(Boolean);
      
      // Triple-check: Remove the profile owner from their own friends list display
      allFriends = allFriends.filter(friend => friend && friend.id && friend.id !== profileUserId);
      
      // If viewing someone else's profile and their list is private, only show mutual friends
      if (!isOwnProfile && friendsPrivacy === 'private' && currentUser?.uid) {
        try {
          const myFriendIds = await listFriendIds(currentUser.uid);
          // Only keep friends that are also in the current user's friend list (mutual friends)
          allFriends = allFriends.filter(friend => myFriendIds.includes(friend.id));
        } catch (error) {
          console.error('Error filtering mutual friends:', error);
          allFriends = [];
        }
      }
      
      setFriendsList(allFriends);
    } catch (error) {
      console.error('Error fetching friends list:', error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const toggleFriendsPrivacy = async () => {
    const newPrivacy = friendsPrivacy === 'public' ? 'private' : 'public';
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'profilePrivacy.friendsList': newPrivacy
      });
      setFriendsPrivacy(newPrivacy);
    } catch (error) {
      console.error('Error updating privacy:', error);
      alert('Failed to update privacy settings');
    }
  };

  useEffect(() => {
    if (activeTab === 'friends') {
      // When viewing others' profile, always show 'friends' tab (no Requests)
      if (!isOwnProfile) {
        setFriendsSubTab('friends');
      } else {
        // Ensure sub-tab default when user navigates to Friends tab without deep-link
        // Priority: location.state.friendsSubTab -> query param friendsSubTab -> default 'friends'
        try {
          const stateSub = location?.state?.friendsSubTab || location?.state?.friendsTab;
          const querySub = new URLSearchParams(location?.search || '').get('friendsSubTab');
          const initialSub = stateSub || querySub || 'friends';
          setFriendsSubTab(initialSub);
        } catch {
          setFriendsSubTab('friends');
        }
      }

      // Always fetch friends list, the fetchFriendsList will handle privacy filtering
      fetchFriendsList();
      // Also fetch pending friend requests for current user (received) - only on own profile
      if (isOwnProfile && currentUser?.uid) fetchFriendRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profileUserId, friendsPrivacy]);

  const fetchFriendRequests = async () => {
    if (!currentUser?.uid) return;
    try {
      // Query friendships with status 'pending' where current user is in users
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      const col = collection(db, 'friendships');
      const q = query(col, where('status', '==', 'pending'), where('users', 'array-contains', currentUser.uid));
      const snap = await getDocs(q);
      const requests = [];
      for (const d of snap.docs) {
        const data = d.data() || {};
        if (data.requestedBy && data.requestedBy !== currentUser.uid) {
          // requestedBy is the sender
          try {
            const userDoc = await getDoc(doc(db, 'users', data.requestedBy));
            if (userDoc.exists()) {
              requests.push({ id: data.requestedBy, ...userDoc.data() });
            } else {
              requests.push({ id: data.requestedBy });
            }
          } catch {
            requests.push({ id: data.requestedBy });
          }
        }
      }
      setFriendRequests(requests);
    } catch (err) {
      console.error('Error fetching friend requests:', err);
    }
  };

  const handleAcceptRequest = async (senderId) => {
    if (!currentUser?.uid) return;
    // Optimistic UI: immediately show friend state + small animation
    setProfileFriendStatus('friends');
    setAcceptedAnim(true);
    try {
      await acceptFriendRequest(currentUser.uid, senderId, currentUser.displayName || currentUser.email || 'Someone');
      // refresh lists from server to ensure consistency
      fetchFriendsList();
      fetchFriendRequests();
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      // Revert optimistic update on failure
      setProfileFriendStatus('pending-received');
    } finally {
      // End animation after short delay
      setTimeout(() => setAcceptedAnim(false), 700);
    }
  };

  const handleDeleteRequest = async (senderId) => {
    if (!currentUser?.uid) return;
    try {
      await cancelFriendRequest(currentUser.uid, senderId);
      fetchFriendRequests();
    } catch (err) {
      console.error('Failed to delete/cancel friend request:', err);
    }
  };

  const fetchDonationHistory = async () => {
    try {
      setDonationsLoading(true);
      let docs = [];
      try {
        const q1 = query(
          collection(db, 'transactions'),
          where('type', '==', 'donation'),
          where('donorId', '==', profileUserId),
          orderBy('createdAt', 'desc')
        );
        const snap1 = await getDocs(q1);
        docs = snap1.docs;
      } catch (primaryErr) {
        console.warn('Primary donations query failed (likely missing index); using fallback:', primaryErr?.message);
        // Fallback: only donorId filter, no orderBy (sort client-side); also accept legacy docs without type
        const q2 = query(
          collection(db, 'transactions'),
          where('donorId', '==', profileUserId)
        );
        const snap2 = await getDocs(q2);
        docs = snap2.docs.filter(d => (d.data()?.type || 'donation') === 'donation');
      }
      const donationData = await Promise.all(
        docs.map(async (donationDoc) => {
          const donation = donationDoc.data();
          
          const campaignTitle = donation.postTitle || 'Campaign';
          // Fetch recipient details (simple doc read)
          let recipientName = 'Unknown';
          let recipientPhoto = null;
          if (donation.recipientId) {
            try {
              const recipientSnap = await getDoc(doc(db, 'users', donation.recipientId));
              if (recipientSnap.exists()) {
                const recipient = recipientSnap.data();
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
      
      // Client-side sort by createdAt (fallback safe)
      donationData.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      
      setDonations(donationData);
    } catch (error) {
      console.error('Error fetching donation history:', error);
    } finally {
      setDonationsLoading(false);
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

  const fetchUserCommunityPosts = async () => {
    try {
      const q = query(
        collectionGroup(db, 'updates'),
        where('authorId', '==', profileUserId)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data(), campaignId: d.ref.parent.parent.id }));
      // Client-side sort by createdAt desc (safe if timestamp or ISO string)
      items.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      setUserCommunityPosts(items);
    } catch (e) {
      console.error('Error fetching user community posts:', e);
      setUserCommunityPosts([]);
    }
  };

  const fetchReceivedHistory = async () => {
    try {
      setReceivedLoading(true);
      let docs = [];
      try {
        const q1 = query(
          collection(db, 'transactions'),
          where('type', '==', 'donation'),
          where('recipientId', '==', profileUserId),
          orderBy('createdAt', 'desc')
        );
        const snap1 = await getDocs(q1);
        docs = snap1.docs;
      } catch (primaryErr) {
        console.warn('Primary received query failed (likely missing index); using fallback:', primaryErr?.message);
        // Fallback: only recipientId filter; accept legacy docs without type
        const q2 = query(
          collection(db, 'transactions'),
          where('recipientId', '==', profileUserId)
        );
        const snap2 = await getDocs(q2);
        docs = snap2.docs.filter(d => (d.data()?.type || 'donation') === 'donation');
      }
      const receivedData = await Promise.all(
        docs.map(async (donationDoc) => {
          const donation = donationDoc.data();
          const campaignTitle = donation.postTitle || 'Campaign';
          // Fetch donor details
          let donorName = 'Anonymous';
          let donorPhoto = null;
          if (donation.donorId) {
            try {
              const donorSnap = await getDoc(doc(db, 'users', donation.donorId));
              if (donorSnap.exists()) {
                const donor = donorSnap.data();
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
      // Client-side sort by createdAt (fallback safe)
      receivedData.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
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

  const formatCurrency = (amount) => formatCurrencyShort(amount, { maxDigits: 5 });

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
  // Derived stats from transactions
  const helpedPeopleCount = useMemo(() => {
    const ids = new Set((donations || []).map(d => d.recipientId).filter(Boolean));
    return ids.size;
  }, [donations]);
  const helpersCount = useMemo(() => {
    const ids = new Set((receivedDonations || []).map(d => d.donorId).filter(Boolean));
    return ids.size;
  }, [receivedDonations]);
  const joinDate = userProfile?.createdAt?.toDate ? 
    new Date(userProfile.createdAt.toDate()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 
    'October 2025';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 animate-fade-in">
        {/* Profile Header */}
        <div
          className="card p-6 mb-6 animate-slide-in-up"
          style={{
            transform: acceptedAnim ? 'scale(1.02)' : 'scale(1)',
            transition: 'transform 320ms ease, box-shadow 320ms ease',
            boxShadow: acceptedAnim ? '0 8px 30px rgba(34,197,94,0.08)' : undefined
          }}
        >
          <div className="flex items-center gap-6">
            {/* Profile Picture */}
            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center shrink-0">
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
              {!isOwnProfile && (
                <div className="mt-3 flex items-center gap-3">
                  {/* If already friends, show badge on the left */}
                  {profileFriendStatus === 'friends' && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 font-medium">Friends</span>
                  )}

                  <AddFriendButton 
                    targetUserId={profileUserId} 
                    targetName={userProfile?.displayName || ''} 
                    hideInlineActions={true}
                    onStatusChange={(newStatus) => setProfileFriendStatus(newStatus)}
                  />
                </div>
              )}
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
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Profile sections">
            <button
              onClick={() => setActiveTab('personal')}
              className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                activeTab === 'personal'
                  ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
              }`}
              role="tab"
              aria-selected={activeTab === 'personal'}
            >
              <span className="hidden sm:inline">Personal Info</span>
              <span className="sm:hidden">Info</span>
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                activeTab === 'campaigns'
                  ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
              }`}
              role="tab"
              aria-selected={activeTab === 'campaigns'}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                activeTab === 'community'
                  ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
              }`}
              role="tab"
              aria-selected={activeTab === 'community'}
            >
              <span className="hidden sm:inline">Community Posts</span>
              <span className="sm:hidden">Posts</span>
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('donations')}
                className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                  activeTab === 'donations'
                    ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
                }`}
                role="tab"
                aria-selected={activeTab === 'donations'}
              >
                <span className="hidden sm:inline">Donation History</span>
                <span className="sm:hidden">Sent</span>
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('received')}
                className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                  activeTab === 'received'
                    ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
                }`}
                role="tab"
                aria-selected={activeTab === 'received'}
              >
                <span className="hidden sm:inline">Received History</span>
                <span className="sm:hidden">Received</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('friends')}
              className={`relative px-3 sm:px-6 py-2.5 sm:py-3 font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 text-xs sm:text-base border-b-2 ${
                activeTab === 'friends'
                  ? 'text-green-700 dark:text-green-400 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-(--hover-bg) hover:text-(--text) border-transparent'
              }`}
              role="tab"
              aria-selected={activeTab === 'friends'}
            >
              Friends
            </button>
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
                    {formatCurrency(walletStats.totalDonated)}
                  </p>
                </div>
              </div>

              {/* Received Stat */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FavoriteIcon className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Received</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(walletStats.totalReceived)}
                  </p>
                </div>
              </div>

              {/* Helped Stat */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <HandshakeIcon className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Helped</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {helpedPeopleCount}
                  </p>
                </div>
              </div>

              {/* Helpers Stat */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <FavoriteIcon className="text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Helpers</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {helpersCount}
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

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
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

            {/* Community Posts Tab */}
            {activeTab === 'community' && (
              <div className="space-y-4">
                {userCommunityPosts.length === 0 ? (
                  <div className="card p-12 text-center text-themed-secondary">No community posts yet</div>
                ) : (
                  userCommunityPosts.map((p) => (
                    <Link key={p.id} to={`/community-post/${p.campaignId}/${p.id}`} className="card p-4 hover:shadow-md transition-shadow block">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                          {p.authorPhoto ? (
                            <img src={p.authorPhoto} alt={p.authorName} className="w-10 h-10 object-cover" />
                          ) : (
                            <PersonIcon className="text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-themed">{p.authorName || 'You'}</div>
                          <div className="text-xs text-themed-muted">
                            {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : (p.createdAt || '')}
                            {p.locationCity || p.locationCountry ? ` • ${p.locationCity || ''}${p.locationCity && p.locationCountry ? ', ' : ''}${p.locationCountry || ''}` : ''}
                          </div>
                          <p className="mt-2 text-themed-secondary line-clamp-3">{p.content}</p>
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt="" className="mt-3 rounded-lg max-h-64 object-cover w-full" />
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
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
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
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
                                    <Link to={`/profile/${donation.recipientId || ''}`} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>
                                      {donation.recipientName}
                                    </Link>
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
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
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
                                    <Link to={`/profile/${donation.donorId || ''}`} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>
                                      {donation.donorName}
                                    </Link>
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

            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  {/* Move sub-tabs into header and remove big H2 */}
                  <div className="inline-flex items-center gap-4">
                    {/* Only show Requests button on own profile */}
                    {isOwnProfile && (
                      <button
                        onClick={() => setFriendsSubTab('requests')}
                        className={`px-5 py-2.5 rounded-full transition-all font-semibold text-base sm:text-lg ${
                          friendsSubTab === 'requests'
                            ? 'bg-green-400 text-white shadow-md'
                            : 'bg-green-50 text-green-700 hover:bg-green-400 hover:text-white'
                        }`}
                        aria-pressed={friendsSubTab === 'requests'}
                      >
                        Requests
                      </button>
                    )}

                    <button
                      onClick={() => setFriendsSubTab('friends')}
                      className={`px-5 py-2.5 rounded-full transition-all font-semibold text-base sm:text-lg ${
                        friendsSubTab === 'friends'
                          ? 'bg-green-400 text-white shadow-md'
                          : 'bg-green-50 text-green-700 hover:bg-green-400 hover:text-white'
                      }`}
                      aria-pressed={friendsSubTab === 'friends'}
                    >
                      Friends
                    </button>
                  </div>

                  {isOwnProfile && (
                    <button
                      onClick={toggleFriendsPrivacy}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                      title={`Friends list is ${friendsPrivacy}`}
                    >
                      {friendsPrivacy === 'public' ? (
                        <>
                          <PublicIcon className="text-green-600 dark:text-green-400" fontSize="small" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Public</span>
                        </>
                      ) : (
                        <>
                          <LockIcon className="text-gray-600 dark:text-gray-400" fontSize="small" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Private</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Only show Requests content on own profile */}
                {friendsSubTab === 'requests' && isOwnProfile ? (
                  <div>
                    {friendRequests.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-themed-secondary">You don't have any friend requests</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {friendRequests.map((req) => (
                          <div key={req.id} className="card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Link to={`/profile/${req.id}`} state={{ friendsSubTab: 'requests' }} className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shrink-0">
                                {req.photoURL ? (
                                  <img src={req.photoURL} alt={req.displayName || req.email} className="w-12 h-12 object-cover" />
                                ) : (
                                  <PersonIcon className="text-gray-400" />
                                )}
                              </Link>
                              <div>
                                <Link to={`/profile/${req.id}`} state={{ friendsSubTab: 'requests' }} className="font-medium" style={{ color: 'var(--text)' }}>{req.displayName || req.email || 'Anonymous'}</Link>
                                {req.title && <div className="text-sm text-gray-500">{req.title}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleAcceptRequest(req.id)} className="px-4 py-2 bg-green-400 text-white rounded-full font-medium hover:bg-green-500">Accept</button>
                              <button onClick={() => handleDeleteRequest(req.id)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full font-medium hover:bg-gray-200">Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  null
                )}

                {friendsSubTab === 'friends' && (
                  friendsLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading friends...</p>
                    </div>
                  ) : friendsList.length === 0 ? (
                    <div className="text-center py-12">
                      {!isOwnProfile && friendsPrivacy === 'private' ? (
                        <>
                          <LockIcon className="text-gray-400 mb-4" sx={{ fontSize: 48 }} />
                          <p className="text-themed-secondary">This user's friends list is private</p>
                          <p className="text-sm text-gray-500 mt-2">Only mutual friends are shown</p>
                        </>
                      ) : (
                        <p className="text-themed-secondary">
                          {isOwnProfile ? 'You haven\'t added any friends yet' : 'No friends to show'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {!isOwnProfile && friendsPrivacy === 'private' && friendsList.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2">
                          <LockIcon className="text-blue-600 dark:text-blue-400" fontSize="small" />
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            This user's friends list is private. Showing {friendsList.length} mutual friend{friendsList.length > 1 ? 's' : ''}.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {friendsList
                          .filter(friend => friend && friend.id && friend.id !== profileUserId)
                          .map((friend) => (
                          <Link
                            key={friend.id}
                          to={`/profile/${friend.id}`}
                          className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3"
                        >
                          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                            {friend.photoURL ? (
                              <img
                                src={friend.photoURL}
                                alt={friend.displayName || 'Friend'}
                                className="w-12 h-12 object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <PersonIcon className="text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" style={{ color: 'var(--text)' }}>
                              {friend.displayName || friend.email || 'Anonymous'}
                            </p>
                            {friend.title && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                {friend.title}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                    </>
                  )
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
