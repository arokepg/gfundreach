import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { Link } from 'react-router-dom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { formatCurrencyShort } from '../../utils/numberFormat';

export default function TopDonors() {
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Aggregate all donations by donorId in a single pass
        let txDocs = [];
        try {
          const snap = await getDocs(collection(db, 'transactions'));
          txDocs = snap.docs;
        } catch (e) {
          console.error('Failed to load transactions:', e);
          txDocs = [];
        }

        const totals = new Map();
        const recipientsByDonor = new Map();
        for (const d of txDocs) {
          const t = d.data();
          const type = t.type || 'donation';
          if (type !== 'donation') continue;
          const donorId = t.donorId;
          if (!donorId) continue;
          const amt = Number(t.amount) || 0;
          totals.set(donorId, (totals.get(donorId) || 0) + amt);
          if (t.recipientId) {
            if (!recipientsByDonor.has(donorId)) recipientsByDonor.set(donorId, new Set());
            recipientsByDonor.get(donorId).add(t.recipientId);
          }
        }

        // Fetch user profiles for donors
        const donorIds = Array.from(totals.keys());
        const donorProfiles = await Promise.all(
          donorIds.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              return { uid, profile: snap.exists() ? snap.data() : null };
            } catch (e) {
              return { uid, profile: null };
            }
          })
        );

        const rows = donorProfiles.map(({ uid, profile }) => ({
          id: uid,
          name: profile?.displayName || profile?.email || 'Anonymous',
          photoURL: profile?.photoURL || null,
          totalDonated: totals.get(uid) || 0,
          helpedCount: recipientsByDonor.get(uid)?.size || 0,
        }));

        rows.sort((a, b) => b.totalDonated - a.totalDonated);
        setDonors(rows);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatAmount = (n) => formatCurrencyShort(n || 0, { maxDigits: 5 });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-6">
          <EmojiEventsIcon className="text-green-600" />
          <h1 className="text-2xl font-bold text-themed">Top Donors</h1>
        </div>

        {loading ? (
          <div className="card p-6 text-themed-muted">Loading…</div>
        ) : donors.length === 0 ? (
          <div className="card p-6 text-themed-muted">No donations yet</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-outline-variant">
              {donors.map((d, idx) => (
                <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-(--hover-bg)">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                    {idx + 1}
                  </div>
                  <Link to={`/profile/${d.id}`} className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 hover:opacity-90">
                    {d.photoURL ? (
                      <img src={d.photoURL} alt={d.name} className="w-12 h-12 object-cover" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center text-themed-muted">👤</div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${d.id}`} className="font-semibold text-themed hover:underline truncate">
                      {d.name}
                    </Link>
                    <div className="text-xs text-themed-muted">{d.helpedCount} helped</div>
                  </div>
                  <div className="shrink-0 font-semibold text-green-700 dark:text-green-400">
                    {formatAmount(d.totalDonated)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
