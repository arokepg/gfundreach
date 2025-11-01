import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Minimal admin gate: assumes userProfile.role === 'admin'
export default function AdminDashboard() {
  const { userProfile, currentUser, fetchUserProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('reports'); // 'reports' | 'users' | 'campaigns' | 'analytics'
  const [reports, setReports] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (tab === 'reports') fetchReports();
    if (tab === 'users') fetchUsers();
  }, [tab, isAdmin]);

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
      // Basic moderation: hide/remove content referenced by the report
      const meta = report.meta || {};
      const now = new Date().toISOString();
      if (report.targetType === 'campaign' && report.targetId) {
        await updateDoc(doc(db, 'posts', String(report.targetId)), { hidden: true, hiddenAt: now });
      } else if (report.targetType === 'community_post' && meta.campaignId && report.targetId) {
        await updateDoc(doc(db, 'posts', String(meta.campaignId), 'updates', String(report.targetId)), { hidden: true, hiddenAt: now });
      } else if (report.targetType === 'group_post' && meta.groupId && report.targetId) {
        await updateDoc(doc(db, 'groups', String(meta.groupId), 'posts', String(report.targetId)), { hidden: true, hiddenAt: now });
      }
      alert('Content moderated (hidden).');
    } catch (e) {
      console.error('Failed to moderate content', e);
      alert('Moderation failed. Check console.');
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)' }}>Admin Dashboard</h1>
        <div className="flex gap-2 mb-6">
          {['reports','users','campaigns','analytics'].map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-full font-medium ${tab===k ? 'pill-active' : 'pill'}`}
            >{k[0].toUpperCase()+k.slice(1)}</button>
          ))}
        </div>

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
                      <button onClick={() => removeTargetContent(r)} className="btn-outline">Hide Content</button>
                      <button onClick={() => markReportResolved(r.id)} className="btn-primary">Mark Resolved</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="card p-4">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text)' }}>Users</h2>
            {loading ? (
              <p className="text-themed-secondary">Loading users...</p>
            ) : usersList.length === 0 ? (
              <p className="text-themed-secondary">No users found</p>
            ) : (
              <div className="space-y-2">
                {usersList.map(u => (
                  <div key={u.id} className="p-3 border border-outline-variant rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" style={{ color: 'var(--text)' }}>{u.displayName || u.email || u.id}</p>
                      <p className="text-xs text-themed-muted">id: {u.id} • role: {u.role || 'member'}</p>
                    </div>
                    <div className="flex gap-2">
                      {u.role !== 'admin' ? (
                        <button onClick={() => promoteToAdmin(u.id)} className="btn-primary">Make admin</button>
                      ) : (
                        <button onClick={() => revokeAdmin(u.id)} className="btn-outline">Revoke admin</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'campaigns' && (
          <div className="card p-4">
            <p className="text-themed-secondary">Coming soon: approve/feature/remove campaigns</p>
          </div>
        )}
        {tab === 'analytics' && (
          <div className="card p-4">
            <p className="text-themed-secondary">Coming soon: platform-wide analytics</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
