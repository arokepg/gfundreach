import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, getDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Campaign as CampaignIcon,
  Assessment as AssessmentIcon,
  Flag as FlagIcon,
  VerifiedUser as VerifiedIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as MoneyIcon,
  Visibility as VisibilityIcon,
  Block as BlockIcon,
  Search as SearchIcon,
  Verified as VerifiedBadgeIcon,
} from '@mui/icons-material';
import { formatCurrencyShort } from '../../utils/numberFormat';

// Minimal admin gate: assumes userProfile.role === 'admin'
export default function AdminDashboard() {
  const { userProfile, currentUser, fetchUserProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview'); // 'overview' | 'reports' | 'users' | 'campaigns' | 'verification'
  const [reports, setReports] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [campaignsList, setCampaignsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    totalUsers: 0,
    totalDonations: 0,
    totalViews: 0,
    activeCampaigns: 0,
    verifiedCampaigns: 0,
  });

  const isAdmin = !!(userProfile?.role && String(userProfile.role).toLowerCase() === 'admin');

  useEffect(() => {
    if (!currentUser) return;
    // If we don't have a profile yet, try fetching it once
    if (!userProfile) {
      fetchUserProfile(currentUser.uid).catch(() => {});
      return;
    }
    // Only redirect if we definitively know the user is NOT admin
    if (!isAdmin) {
      navigate('/');
    }
  }, [currentUser, userProfile, isAdmin, navigate, fetchUserProfile]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'overview') fetchStats();
    if (tab === 'reports') fetchReports();
    if (tab === 'users') fetchUsers();
    if (tab === 'campaigns' || tab === 'verification') fetchCampaigns();
  }, [tab, isAdmin]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [campaignsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'posts')),
        getDocs(collection(db, 'users')),
      ]);
      const campaigns = campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const totalDonations = campaigns.reduce((sum, c) => sum + (Number(c.raised) || 0), 0);
      const totalViews = campaigns.reduce((sum, c) => sum + (Number(c.viewCount) || 0), 0);
      const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
      const verifiedCampaigns = campaigns.filter(c => c.verified === true).length;
      setStats({
        totalCampaigns: campaigns.length,
        totalUsers: usersSnap.docs.length,
        totalDonations,
        totalViews,
        activeCampaigns,
        verifiedCampaigns,
      });
    } catch (e) {
      console.error('Failed to load stats', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)));
      setCampaignsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to load campaigns', e);
      setCampaignsList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'reports'));
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to load reports', e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(users);
    } catch (e) {
      console.error('Failed to load users', e);
      setUsersList([]);
    } finally {
      setLoading(false);
    }
  };

  const promoteToAdmin = async (uid) => {
    if (!window.confirm('Promote this user to admin?')) return;
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'admin' });
      setUsersList(prev => prev.map(u => u.id === uid ? { ...u, role: 'admin' } : u));
      alert('User promoted to admin');
    } catch (e) {
      console.error('Failed to promote user', e);
      alert('Failed to promote user');
    }
  };

  const revokeAdmin = async (uid) => {
    if (!window.confirm('Revoke admin role for this user?')) return;
    try {
      await updateDoc(doc(db, 'users', uid), { role: 'member' });
      setUsersList(prev => prev.map(u => u.id === uid ? { ...u, role: 'member' } : u));
      alert('Admin role revoked');
    } catch (e) {
      console.error('Failed to revoke admin', e);
      alert('Failed to revoke admin role');
    }
  };

  const verifyUser = async (uid) => {
    if (!window.confirm('Verify this user? They will get a blue checkmark badge.')) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUser.uid,
      });
      setUsersList(prev => prev.map(u => u.id === uid ? { ...u, verified: true } : u));
      alert('User verified successfully');
    } catch (e) {
      console.error('Failed to verify user', e);
      alert('Failed to verify user');
    }
  };

  const unVerifyUser = async (uid) => {
    if (!window.confirm('Remove verification badge from this user?')) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
      });
      setUsersList(prev => prev.map(u => u.id === uid ? { ...u, verified: false } : u));
      alert('Verification removed');
    } catch (e) {
      console.error('Failed to remove verification', e);
      alert('Failed to remove verification');
    }
  };

  const markReportResolved = async (id) => {
    try {
      await updateDoc(doc(db, 'reports', id), { status: 'resolved', resolvedAt: new Date().toISOString() });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
    } catch (e) {
      console.error('Failed to resolve report', e);
      alert('Failed to resolve report');
    }
  };

  const removeTargetContent = async (report) => {
    try {
      // Moderation: soft-delete by moving the doc into moderationTrash (backup) for 3 days, then delete original
      const meta = report.meta || {};
      const now = new Date().toISOString();
      let refPath = '';
      if (report.targetType === 'campaign' && report.targetId) {
        refPath = `posts/${String(report.targetId)}`;
      } else if (report.targetType === 'community_post' && meta.campaignId && report.targetId) {
        refPath = `posts/${String(meta.campaignId)}/updates/${String(report.targetId)}`;
      } else if (report.targetType === 'group_post' && meta.groupId && report.targetId) {
        refPath = `groups/${String(meta.groupId)}/posts/${String(report.targetId)}`;
      }
      if (!refPath) {
        alert('Unknown content target');
        return;
      }

      const refParts = refPath.split('/');
      const targetSnap = await getDoc(doc(db, ...refParts));
      const original = targetSnap.exists() ? targetSnap.data() : null;
      await setDoc(doc(db, 'moderationTrash', report.id), {
        refPath,
        targetType: report.targetType,
        createdAt: now,
        expireAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        original,
      });
      await deleteDoc(doc(db, ...refParts));
      alert('Content deleted. You can undo within 3 days from this dashboard.');
    } catch (e) {
      console.error('Failed to moderate content', e);
      alert('Moderation failed. Check console.');
    }
  };

  const undoDelete = async (reportId) => {
    try {
      const tSnap = await getDoc(doc(db, 'moderationTrash', reportId));
      if (!tSnap.exists()) {
        alert('Nothing to restore');
        return;
      }
      const t = tSnap.data();
      const expired = new Date(t.expireAt).getTime() < Date.now();
      if (expired) {
        alert('Restore window (3 days) has expired');
        return;
      }
      if (!t.refPath || !t.original) {
        alert('Backup missing data');
        return;
      }
      await setDoc(doc(db, ...t.refPath.split('/')), t.original);
      await deleteDoc(doc(db, 'moderationTrash', reportId));
      alert('Content restored');
    } catch (e) {
      console.error('Failed to restore content', e);
      alert('Failed to restore. See console.');
    }
  };

  const verifyCampaign = async (campaignId) => {
    if (!window.confirm('Verify this campaign creator? This shows a blue checkmark badge.')) return;
    try {
      await updateDoc(doc(db, 'posts', campaignId), { 
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUser.uid,
      });
      setCampaignsList(prev => prev.map(c => c.id === campaignId ? { ...c, verified: true } : c));
      alert('Campaign verified successfully');
    } catch (e) {
      console.error('Failed to verify campaign', e);
      alert('Failed to verify campaign');
    }
  };

  const unVerifyCampaign = async (campaignId) => {
    if (!window.confirm('Remove verification badge from this campaign?')) return;
    try {
      await updateDoc(doc(db, 'posts', campaignId), { 
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
      });
      setCampaignsList(prev => prev.map(c => c.id === campaignId ? { ...c, verified: false } : c));
      alert('Verification removed');
    } catch (e) {
      console.error('Failed to remove verification', e);
      alert('Failed to remove verification');
    }
  };

  const pauseCampaign = async (campaignId) => {
    if (!window.confirm('Pause this campaign? It will be hidden from public view.')) return;
    try {
      await updateDoc(doc(db, 'posts', campaignId), { status: 'paused' });
      setCampaignsList(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'paused' } : c));
      alert('Campaign paused');
    } catch (e) {
      console.error('Failed to pause campaign', e);
      alert('Failed to pause campaign');
    }
  };

  const activateCampaign = async (campaignId) => {
    if (!window.confirm('Activate this campaign?')) return;
    try {
      await updateDoc(doc(db, 'posts', campaignId), { status: 'active' });
      setCampaignsList(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'active' } : c));
      alert('Campaign activated');
    } catch (e) {
      console.error('Failed to activate campaign', e);
      alert('Failed to activate campaign');
    }
  };

  if (!userProfile) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4">
          <div className="card p-6 text-themed-secondary">Loading profile…</div>
        </div>
      </Layout>
    );
  }
  if (!isAdmin) return null;

  // Material Dashboard-inspired KPI Card component
  const StatCard = ({ title, value, icon, color, subtitle }) => {
    const IconComp = icon;
    return (
      <div className="card p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <p className="text-sm text-themed-muted font-medium uppercase tracking-wide">{title}</p>
            <h3 className="text-3xl font-bold text-themed mt-1">{value}</h3>
            {subtitle && <p className="text-xs text-themed-secondary mt-1">{subtitle}</p>}
          </div>
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <IconComp style={{ fontSize: 28, color }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-themed mb-2">Admin Dashboard</h1>
          <p className="text-themed-muted">Manage your platform, verify creators, and monitor activity</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'overview', label: 'Overview', icon: DashboardIcon },
            { key: 'verification', label: 'Verification', icon: VerifiedIcon },
            { key: 'campaigns', label: 'Campaigns', icon: CampaignIcon },
            { key: 'reports', label: 'Reports', icon: FlagIcon },
            { key: 'users', label: 'Users', icon: PeopleIcon },
          ].map(({ key, label, icon }) => {
            const IconComp = icon;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  tab === key ? 'pill-active' : 'pill'
                }`}
              >
                <IconComp fontSize="small" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {loading ? (
              <div className="text-themed-secondary">Loading statistics...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  title="Total Campaigns"
                  value={stats.totalCampaigns}
                  subtitle={`${stats.activeCampaigns} active`}
                  icon={CampaignIcon}
                  color="#16a34a"
                />
                <StatCard
                  title="Total Users"
                  value={stats.totalUsers}
                  icon={PeopleIcon}
                  color="#2563eb"
                />
                <StatCard
                  title="Total Raised"
                  value={formatCurrencyShort(stats.totalDonations)}
                  icon={MoneyIcon}
                  color="#dc2626"
                />
                <StatCard
                  title="Total Views"
                  value={formatCurrencyShort(stats.totalViews)}
                  icon={VisibilityIcon}
                  color="#9333ea"
                />
                <StatCard
                  title="Verified Campaigns"
                  value={stats.verifiedCampaigns}
                  subtitle={`${((stats.verifiedCampaigns / Math.max(stats.totalCampaigns, 1)) * 100).toFixed(1)}% verified`}
                  icon={VerifiedIcon}
                  color="#0891b2"
                />
                <StatCard
                  title="Platform Health"
                  value={reports.length}
                  subtitle="pending reports"
                  icon={FlagIcon}
                  color="#ea580c"
                />
              </div>
            )}

            {/* Quick Actions */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-themed mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => setTab('verification')}
                  className="p-4 rounded-lg border-2 border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
                >
                  <VerifiedIcon className="text-green-600 mb-2" />
                  <p className="font-semibold text-themed">Verify Creators</p>
                  <p className="text-xs text-themed-muted">Review pending verifications</p>
                </button>
                <button
                  onClick={() => setTab('reports')}
                  className="p-4 rounded-lg border-2 border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left"
                >
                  <FlagIcon className="text-orange-600 mb-2" />
                  <p className="font-semibold text-themed">Review Reports</p>
                  <p className="text-xs text-themed-muted">Handle content moderation</p>
                </button>
                <button
                  onClick={() => setTab('campaigns')}
                  className="p-4 rounded-lg border-2 border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                >
                  <CampaignIcon className="text-blue-600 mb-2" />
                  <p className="font-semibold text-themed">Manage Campaigns</p>
                  <p className="text-xs text-themed-muted">Approve, pause, or feature</p>
                </button>
                <button
                  onClick={() => setTab('users')}
                  className="p-4 rounded-lg border-2 border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
                >
                  <PeopleIcon className="text-purple-600 mb-2" />
                  <p className="font-semibold text-themed">User Management</p>
                  <p className="text-xs text-themed-muted">Promote admins, view users</p>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-themed mb-4">Recent Activity</h2>
              <p className="text-themed-muted text-sm">Coming soon: real-time activity feed</p>
            </div>
          </div>
        )}

        {/* Verification Tab */}
        {tab === 'verification' && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <VerifiedIcon className="text-blue-600" style={{ fontSize: 32 }} />
              <div>
                <h2 className="text-xl font-semibold text-themed">Creator Verification</h2>
                <p className="text-sm text-themed-muted">Verify campaign creators to build trust with donors</p>
              </div>
            </div>
            
            {/* Info Box */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">About Verification</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                Verified campaigns display a blue checkmark badge, indicating the creator has passed identity verification.
                This significantly increases donor trust and donation likelihood.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Review each campaign carefully before verifying. Check creator identity, campaign legitimacy, and contact information.
              </p>
            </div>

            {loading ? (
              <p className="text-themed-secondary">Loading campaigns...</p>
            ) : campaignsList.length === 0 ? (
              <p className="text-themed-secondary">No campaigns found</p>
            ) : (
              <div className="space-y-3">
                {/* Filter buttons */}
                <div className="flex gap-2 mb-4">
                  <button className="pill pill-active text-xs">All Campaigns</button>
                  <button className="pill text-xs">Unverified Only</button>
                  <button className="pill text-xs">Verified Only</button>
                </div>

                {campaignsList.map(c => (
                  <div key={c.id} className="p-4 border border-outline-variant rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Campaign Image */}
                      <div className="w-full lg:w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <CampaignIcon className="text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Campaign Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          <Link to={`/post/${c.id}`} className="font-semibold text-themed hover:underline flex-1">
                            {c.title || 'Untitled Campaign'}
                          </Link>
                          {c.verified && (
                            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                              <VerifiedIcon fontSize="small" />
                              <span className="text-xs font-medium">Verified</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-themed-muted line-clamp-2 mb-2">{c.description || 'No description'}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-themed-secondary">
                          <span>By: {c.authorName || 'Anonymous'}</span>
                          <span>•</span>
                          <span>Raised: {formatCurrencyShort(c.raised || 0)}</span>
                          <span>•</span>
                          <span>Goal: {formatCurrencyShort(c.goal || 0)}</span>
                          <span>•</span>
                          <span className={`font-medium ${c.status === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
                            {c.status || 'unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 justify-end">
                        {!c.verified ? (
                          <button
                            onClick={() => verifyCampaign(c.id)}
                            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <CheckIcon fontSize="small" />
                            Verify
                          </button>
                        ) : (
                          <button
                            onClick={() => unVerifyCampaign(c.id)}
                            className="flex items-center gap-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                          >
                            <CancelIcon fontSize="small" />
                            Unverify
                          </button>
                        )}
                        <Link
                          to={`/post/${c.id}`}
                          className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-themed"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {tab === 'campaigns' && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-themed mb-6">Campaign Management</h2>
            {loading ? (
              <p className="text-themed-secondary">Loading campaigns...</p>
            ) : campaignsList.length === 0 ? (
              <p className="text-themed-secondary">No campaigns found</p>
            ) : (
              <div className="space-y-3">
                {campaignsList.map(c => (
                  <div key={c.id} className="p-4 border border-outline-variant rounded-xl">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Link to={`/post/${c.id}`} className="font-semibold text-themed hover:underline">
                            {c.title || 'Untitled Campaign'}
                          </Link>
                          {c.verified && <VerifiedIcon className="text-blue-600" fontSize="small" />}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-themed-secondary">
                          <span>Status: <span className="font-medium">{c.status || 'unknown'}</span></span>
                          <span>•</span>
                          <span>Raised: {formatCurrencyShort(c.raised || 0)} / {formatCurrencyShort(c.goal || 0)}</span>
                          <span>•</span>
                          <span>Views: {c.viewCount || 0}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {c.status === 'active' ? (
                          <button
                            onClick={() => pauseCampaign(c.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                          >
                            <BlockIcon fontSize="small" />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => activateCampaign(c.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            <CheckIcon fontSize="small" />
                            Activate
                          </button>
                        )}
                        <Link
                          to={`/post/${c.id}`}
                          className="px-3 py-2 border border-outline-variant rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-themed"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && (
          <div className="card p-4">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text)' }}>Reported Content</h2>
            {loading ? (
              <p className="text-themed-secondary">Loading...</p>
            ) : reports.length === 0 ? (
              <p className="text-themed-secondary">No reports found</p>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="p-3 border border-outline-variant rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: 'var(--text)' }}>{r.reason || 'Reported item'}</p>
                      <p className="text-xs text-themed-muted">type: {r.targetType || '-'} • id: {r.targetId || '-'}</p>
                      {r.comment && <p className="text-sm text-themed-secondary mt-1 line-clamp-2">"{r.comment}"</p>}
                      <p className="text-xs text-gray-400 mt-1">status: {r.status || 'open'}</p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => removeTargetContent(r)} className="btn-outline">Delete</button>
                      <button onClick={() => undoDelete(r.id)} className="btn-secondary">Undo delete</button>
                      <button onClick={() => markReportResolved(r.id)} className="btn-primary">Mark Resolved</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-themed mb-4">User Management</h2>
            
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-themed-muted" />
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 w-full"
                />
              </div>
            </div>

            {loading ? (
              <p className="text-themed-secondary">Loading users...</p>
            ) : usersList.length === 0 ? (
              <p className="text-themed-secondary">No users found</p>
            ) : (
              <div className="space-y-3">
                {usersList
                  .filter(u => {
                    if (!searchQuery) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      (u.displayName || '').toLowerCase().includes(q) ||
                      (u.email || '').toLowerCase().includes(q) ||
                      (u.id || '').toLowerCase().includes(q)
                    );
                  })
                  .map(u => (
                  <div key={u.id} className="p-4 border border-outline-variant rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <PeopleIcon className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-themed">{u.displayName || u.email || u.id}</p>
                            {u.verified && (
                              <VerifiedBadgeIcon className="text-blue-500" style={{ fontSize: 18 }} titleAccess="Verified User" />
                            )}
                          </div>
                          <p className="text-xs text-themed-muted truncate">
                            {u.email || u.id} • {u.role || 'member'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {!u.verified ? (
                          <button
                            onClick={() => verifyUser(u.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            <VerifiedBadgeIcon fontSize="small" />
                            Verify
                          </button>
                        ) : (
                          <button
                            onClick={() => unVerifyUser(u.id)}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                          >
                            <CancelIcon fontSize="small" />
                            Unverify
                          </button>
                        )}
                        {u.role !== 'admin' ? (
                          <button onClick={() => promoteToAdmin(u.id)} className="btn-primary text-sm px-3 py-2">Make admin</button>
                        ) : (
                          <button onClick={() => revokeAdmin(u.id)} className="btn-outline text-sm px-3 py-2">Revoke admin</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
