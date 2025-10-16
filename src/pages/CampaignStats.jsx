import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const CampaignStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);

  useEffect(() => {
    fetchCampaignStats();
  }, [id]);

  const fetchCampaignStats = async () => {
    try {
      // Fetch campaign data
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check if current user is the campaign owner
        if (data.authorId !== currentUser.uid) {
          alert('You do not have permission to view these statistics');
          navigate('/profile');
          return;
        }
        
        setCampaign({ id: docSnap.id, ...data });

        // Fetch donations for this campaign (if donations collection exists)
        try {
          const donationsQuery = query(
            collection(db, 'donations'),
            where('postId', '==', id),
            orderBy('createdAt', 'desc')
          );
          
          const donationsSnap = await getDocs(donationsQuery);
          const donationsData = donationsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          setDonations(donationsData);
        } catch (donationError) {
          console.log('No donations found or donations collection does not exist:', donationError);
          // Continue without donations - this is not critical
          setDonations([]);
        }
      } else {
        alert('Campaign not found');
        navigate('/profile');
      }
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      // More user-friendly error handling
      setLoading(false);
      alert('Unable to load campaign statistics. Please try again.');
      navigate('/profile');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const calculateProgress = () => {
    if (!campaign) return 0;
    return Math.min((campaign.currentAmount / campaign.goalAmount) * 100, 100);
  };

  const calculateAverageDonation = () => {
    if (donations.length === 0) return 0;
    const total = donations.reduce((sum, donation) => sum + (donation.amount || 0), 0);
    return total / donations.length;
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6">
          <div className="card p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6">
          <div className="card p-8 text-center">
            <p className="text-themed-secondary">Campaign not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-themed-secondary hover:text-themed mb-6 transition-colors"
        >
          <ArrowBackIcon />
          <span>Back to Profile</span>
        </button>

        <div className="space-y-6">
          {/* Campaign Header */}
          <div className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium mb-2">
                  {campaign.category}
                </span>
                <h1 className="text-3xl font-bold text-themed">{campaign.title}</h1>
              </div>
              <Link
                to={`/post/${id}`}
                className="btn-secondary flex items-center gap-2"
              >
                <VisibilityIcon fontSize="small" />
                View Campaign
              </Link>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(campaign.currentAmount || 0)}
                </span>
                <span className="text-themed-secondary">
                  of {formatCurrency(campaign.goalAmount)}
                </span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
              <p className="text-right text-sm text-themed-secondary mt-1">
                {calculateProgress().toFixed(1)}% funded
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <AttachMoneyIcon className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Total Raised</p>
                  <p className="text-2xl font-bold text-themed">
                    {formatCurrency(campaign.currentAmount || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <PeopleIcon className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Supporters</p>
                  <p className="text-2xl font-bold text-themed">
                    {campaign.supporters || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUpIcon className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Avg Donation</p>
                  <p className="text-2xl font-bold text-themed">
                    {formatCurrency(calculateAverageDonation())}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <CalendarTodayIcon className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Created</p>
                  <p className="text-lg font-bold text-themed">
                    {formatDate(campaign.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Donations */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-themed mb-4">Recent Donations</h2>
            
            {donations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-themed-secondary">No donations yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {donations.slice(0, 10).map((donation) => (
                  <div
                    key={donation.id}
                    className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-themed">
                        {donation.donorName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-themed-secondary">
                        {formatDate(donation.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(donation.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CampaignStats;
