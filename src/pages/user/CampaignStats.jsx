import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, orderBy, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CampaignStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [viewsTotal, setViewsTotal] = useState(0);
  const [views7d, setViews7d] = useState(0);
  const [uniqueVisitorsTotal, setUniqueVisitorsTotal] = useState(0);
  const [uniqueVisitors30d, setUniqueVisitors30d] = useState(0);
  const [viewsChartData, setViewsChartData] = useState([]);
  const [donationsChartData, setDonationsChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  useEffect(() => {
    fetchCampaignStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCampaignStats = async () => {
    try {
      // Fetch campaign data
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check if current user is the campaign owner
        if (data.authorId !== currentUser?.uid) {
          alert('You do not have permission to view these statistics');
          navigate('/profile');
          return;
        }
        
        setCampaign({ id: docSnap.id, ...data });

        // Views and Visitors counts (using subcollections created by view tracker)
        try {
          const viewsCol = collection(db, 'posts', id, 'views');
          const totalViewsSnap = await getCountFromServer(query(viewsCol));
          setViewsTotal(totalViewsSnap.data().count || 0);

          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const sevenTs = Timestamp.fromDate(sevenDaysAgo);
          const views7Snap = await getCountFromServer(
            query(viewsCol, where('createdAt', '>=', sevenTs))
          );
          setViews7d(views7Snap.data().count || 0);

          const visitorsCol = collection(db, 'posts', id, 'visitors');
          const totalVisitorsSnap = await getCountFromServer(query(visitorsCol));
          setUniqueVisitorsTotal(totalVisitorsSnap.data().count || 0);

          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const thirtyTs = Timestamp.fromDate(thirtyDaysAgo);
          const visitors30Snap = await getCountFromServer(
            query(visitorsCol, where('lastViewedAt', '>=', thirtyTs))
          );
          setUniqueVisitors30d(visitors30Snap.data().count || 0);
        } catch (viewErr) {
          console.log('View stats not available yet:', viewErr);
        }

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
          
          // Process donations for chart data (last 30 days)
          const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const donationsByDay = {};
          
          donationsData.forEach(donation => {
            const date = donation.createdAt?.toDate ? donation.createdAt.toDate() : new Date(donation.createdAt);
            if (date >= last30Days) {
              const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              donationsByDay[dayKey] = (donationsByDay[dayKey] || 0) + (donation.amount || 0);
            }
          });
          
          const donationsChart = Object.entries(donationsByDay)
            .map(([date, amount]) => ({ date, amount }))
            .slice(-14); // Last 14 days
          
          setDonationsChartData(donationsChart);
        } catch (donationError) {
          console.log('No donations found or donations collection does not exist:', donationError);
          // Continue without donations - this is not critical
          setDonations([]);
          setDonationsChartData([]);
        }

        // Fetch views data for chart (last 14 days)
        try {
          const viewsCol = collection(db, 'posts', id, 'views');
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          const fourteenTs = Timestamp.fromDate(fourteenDaysAgo);
          
          const viewsQuery = query(viewsCol, where('createdAt', '>=', fourteenTs));
          const viewsSnap = await getDocs(viewsQuery);
          
          const viewsByDay = {};
          viewsSnap.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            viewsByDay[dayKey] = (viewsByDay[dayKey] || 0) + 1;
          });
          
          const viewsChart = Object.entries(viewsByDay)
            .map(([date, views]) => ({ date, views }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          
          setViewsChartData(viewsChart);
        } catch (viewChartErr) {
          console.log('Views chart data not available:', viewChartErr);
          setViewsChartData([]);
        }

        // Create category breakdown data
        setCategoryData([
          { name: 'Total Raised', value: data.currentAmount || 0, color: '#10b981' },
          { name: 'Goal Remaining', value: Math.max((data.goalAmount || 0) - (data.currentAmount || 0), 0), color: '#e5e7eb' }
        ]);
      } else {
        alert('Campaign not found');
        navigate('/profile');
      }
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      // More user-friendly error handling
      alert('Unable to load campaign statistics. Please try again.');
      navigate('/profile');
    } finally {
      // Ensure loading state is cleared whether success or failure
      setLoading(false);
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
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <VisibilityIcon className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Total Views</p>
                  <p className="text-2xl font-bold text-themed">{viewsTotal}</p>
                </div>
              </div>
              <p className="text-xs text-themed-muted">Last 7 days: {views7d}</p>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <PeopleIcon className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Unique Viewers</p>
                  <p className="text-2xl font-bold text-themed">{uniqueVisitorsTotal}</p>
                </div>
              </div>
              <p className="text-xs text-themed-muted">Last 30 days: {uniqueVisitors30d}</p>
            </div>

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
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUpIcon className="text-green-600" />
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

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Views Over Time Chart */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-themed mb-4 flex items-center gap-2">
                <TrendingUpIcon className="text-blue-600" />
                Views Trend (Last 14 Days)
              </h2>
              {viewsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={viewsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--card-bg)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-themed-secondary">
                  <div className="text-center">
                    <VisibilityIcon sx={{ fontSize: 48 }} className="mb-2 opacity-50" />
                    <p>No view data available yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Donations Over Time Chart */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-themed mb-4 flex items-center gap-2">
                <AttachMoneyIcon className="text-green-600" />
                Donations Trend (Last 14 Days)
              </h2>
              {donationsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={donationsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--card-bg)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-themed-secondary">
                  <div className="text-center">
                    <AttachMoneyIcon sx={{ fontSize: 48 }} className="mb-2 opacity-50" />
                    <p>No donation data available yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campaign Progress Visualization */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Goal Progress Pie Chart */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-themed mb-4">Campaign Goal Progress</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {calculateProgress().toFixed(1)}%
                </p>
                <p className="text-sm text-themed-secondary">of goal achieved</p>
              </div>
            </div>

            {/* Donation Size Distribution */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-themed mb-4">Donation Distribution</h2>
              {donations.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={donations.slice(0, 10).map((d, i) => ({
                      name: d.donorName || `Donor ${i + 1}`,
                      amount: d.amount || 0
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#6b7280"
                      style={{ fontSize: '10px' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--card-bg)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-themed-secondary">
                  <div className="text-center">
                    <PeopleIcon sx={{ fontSize: 48 }} className="mb-2 opacity-50" />
                    <p>No donations yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Donations Table */}
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
                    className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
