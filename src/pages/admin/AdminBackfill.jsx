import { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';

const chunk = (arr, size) => {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
};

export default function AdminBackfill() {
  const { currentUser } = useAuth();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);

  // TODO: Replace with your real admin policy (e.g., whitelist UIDs or custom claims)
  const isAdmin = Boolean(currentUser?.email?.endsWith('@admin.com'));

  const append = (msg) => setLog((l) => [...l, msg]);

  const run = async () => {
    setRunning(true);
    setLog([]);
    setSummary(null);
    try {
      // Users
      append('Fetching users…');
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDocs = usersSnap.docs;
      let usersUpdated = 0;
      for (const group of chunk(userDocs, 450)) { // stay under 500 writes per batch
        const batch = writeBatch(db);
        for (const d of group) {
          const u = d.data();
          const updates = {};
          const dnLower = (u.displayName || '').toLowerCase();
          const emLower = (u.email || '').toLowerCase();
          if (u.displayNameLower !== dnLower) updates.displayNameLower = dnLower;
          if (u.emailLower !== emLower) updates.emailLower = emLower;
          if (Object.keys(updates).length) {
            batch.set(doc(db, 'users', d.id), updates, { merge: true });
            usersUpdated++;
          }
        }
        if (usersUpdated) await batch.commit();
      }
      append(`Users updated: ${usersUpdated}`);

      // Posts
      append('Fetching posts…');
      const postsSnap = await getDocs(collection(db, 'posts'));
      const postDocs = postsSnap.docs;
      let postsUpdated = 0;
      for (const group of chunk(postDocs, 450)) {
        const batch = writeBatch(db);
        for (const d of group) {
          const p = d.data();
          const tLower = (p.title || '').toLowerCase().trim();
          const updates = {};
          if (p.titleLower !== tLower) updates.titleLower = tLower;
          if (typeof p.updateCount !== 'number') updates.updateCount = p.updateCount || 0;
          if (!('lastUpdateAt' in p)) updates.lastUpdateAt = null;
          if (!('lastUpdatePreview' in p)) updates.lastUpdatePreview = '';
          if (!('visibility' in p)) updates.visibility = 'public';
          if (!('campaignStatus' in p)) updates.campaignStatus = 'active';
          if (!('shortSummary' in p) || !p.shortSummary) {
            const desc = (p.description || '').toString();
            updates.shortSummary = desc.slice(0, 160);
          }
          if (Array.isArray(p.tags)) {
            const tl = p.tags.map((t) => (t || '').toString().toLowerCase());
            if (JSON.stringify(p.tagsLower || []) !== JSON.stringify(tl)) updates.tagsLower = tl;
          } else if (!('tags' in p)) {
            updates.tags = [];
            updates.tagsLower = [];
          }
          // Add reaction/engagement fields
          if (!('likesCount' in p)) updates.likesCount = 0;
          if (!('likedBy' in p)) updates.likedBy = [];
          if (!('sharesCount' in p)) updates.sharesCount = 0;
          
          if (Object.keys(updates).length) {
            batch.set(doc(db, 'posts', d.id), updates, { merge: true });
            postsUpdated++;
          }
        }
        if (postsUpdated) await batch.commit();
      }
      append(`Posts updated: ${postsUpdated}`);

      setSummary({ usersUpdated, postsUpdated });
      append('Backfill complete.');
    } catch (e) {
      append('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto card p-6">
          <h1 className="text-2xl font-bold mb-2">Admin Backfill</h1>
          <p className="text-sm text-gray-600">You don’t have access to this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card p-6">
          <h1 className="text-2xl font-bold mb-2">Admin Backfill</h1>
          <p className="text-sm text-gray-600">
            Populate lowercase search fields for users and posts. This is safe to run multiple times.
          </p>
          <div className="mt-4 flex gap-3">
            <button className="btn-primary" onClick={run} disabled={running}>
              {running ? 'Running…' : 'Run Backfill'}
            </button>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-2">Log</h2>
          <div className="text-sm whitespace-pre-wrap max-h-72 overflow-auto">{log.join('\n')}</div>
          {summary && (
            <div className="mt-3 text-sm">
              Users updated: <b>{summary.usersUpdated}</b> · Posts updated: <b>{summary.postsUpdated}</b>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
