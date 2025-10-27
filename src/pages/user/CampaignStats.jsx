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
  const [uniqueDonors, setUniqueDonors] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [viewsTotal, setViewsTotal] = useState(0);
  const [views7d, setViews7d] = useState(0);
  const [uniqueVisitorsTotal, setUniqueVisitorsTotal] = useState(0);
  const [uniqueVisitors30d, setUniqueVisitors30d] = useState(0);
  const [viewsChartData, setViewsChartData] = useState([]);
  const [donationsChartData, setDonationsChartData] = useState([]);
  const [donationDistribution, setDonationDistribution] = useState([]);
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
  setLikesCount(data.likesCount || 0);
  setSharesCount(data.sharesCount || 0);

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

        // Fetch donations for this campaign using transactions (type=='donation')
        try {
          // Primary query (may require composite index)
          let donationsQuery = query(
            collection(db, 'transactions'),
            where('type', '==', 'donation'),
            where('postId', '==', id),
            orderBy('createdAt', 'desc')
          );
          let donationsSnap;
          try {
            donationsSnap = await getDocs(donationsQuery);
          } catch (primaryErr) {
            // Fallback: avoid composite index by querying only by postId and sorting client-side
            console.warn('Primary donations query failed (falling back):', primaryErr);
            const fallbackQuery = query(
              collection(db, 'transactions'),
              where('postId', '==', id)
            );
            donationsSnap = await getDocs(fallbackQuery);
          }

          const donationsData = donationsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.type === 'donation');

          // Sort client-side by createdAt desc
          donationsData.sort((a, b) => {
            const ad = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const bd = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return bd - ad;
          });

          setDonations(donationsData);
          setUniqueDonors(new Set(donationsData.map(d => d.donorId).filter(Boolean)).size);

          // Build a continuous last-14-days series with zeros
          const days = 14;
          const series = [];
          const today = new Date();
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            series.push({ key, date: key, amount: 0 });
          }
          const byKey = Object.fromEntries(series.map(s => [s.key, s]));

          donationsData.forEach(donation => {
            const dt = donation.createdAt?.toDate ? donation.createdAt.toDate() : (donation.createdAt ? new Date(donation.createdAt) : null);
            if (!dt) return;
            const key = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (byKey[key]) byKey[key].amount += (donation.amount || 0);
          });
          setDonationsChartData(series);

          // Donation distribution by donor (top 5 + Others) for PieChart
          const totalsByDonor = donationsData.reduce((acc, d) => {
            const name = d.donorName || d.donorId || 'Anonymous';
            acc[name] = (acc[name] || 0) + (d.amount || 0);
            return acc;
          }, {});
          const sorted = Object.entries(totalsByDonor)
            .sort((a, b) => b[1] - a[1]);
          const top = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
          const othersSum = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
          const distribution = othersSum > 0 ? [...top, { name: 'Others', value: othersSum }] : top;
          setDonationDistribution(distribution);
        } catch (donationError) {
          console.log('Donations loading failed:', donationError);
          setDonations([]);
          setDonationsChartData([]);
          setDonationDistribution([]);
          setUniqueDonors(0);
        }

        // Fetch views data for chart (last 14 days)
        try {
          const viewsCol = collection(db, 'posts', id, 'views');
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          const fourteenTs = Timestamp.fromDate(fourteenDaysAgo);

          const viewsQuery = query(viewsCol, where('createdAt', '>=', fourteenTs));
          const viewsSnap = await getDocs(viewsQuery);

          // Initialize continuous series for last 14 days
          const days = 14;
          const series = [];
          const today = new Date();
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            series.push({ key, date: key, views: 0 });
          }
          const byKey = Object.fromEntries(series.map(s => [s.key, s]));

          viewsSnap.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : null;
            if (!date) return;
            const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (byKey[key]) byKey[key].views += 1;
          });

          setViewsChartData(series);
        } catch (viewChartErr) {
          console.log('Views chart data not available:', viewChartErr);
          // Still show zeroed series to ensure a chart renders
          const days = 14;
          const series = [];
          const today = new Date();
          for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            series.push({ date: key, views: 0 });
          }
          setViewsChartData(series);
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
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <PeopleIcon className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Unique Donors</p>
                  <p className="text-2xl font-bold text-themed">{uniqueDonors}</p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <TrendingUpIcon className="text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Likes</p>
                  <p className="text-2xl font-bold text-themed">{likesCount}</p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                  <TrendingUpIcon className="text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-themed-secondary">Shares</p>
                  <p className="text-2xl font-bold text-themed">{sharesCount}</p>
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

            {/* Donation Distribution (Top donors + Others) */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-themed mb-4">Donation Distribution</h2>
              {donationDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donationDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    >
                      {donationDistribution.map((entry, index) => (
                        <Cell key={`dd-${index}`} fill={["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
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
