import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { formatCurrencyShort } from '../../utils/numberFormat';

export default function TopDonors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Leaderboard based on denormalized fields on user docs
        const snap = await getDocs(collection(db, 'users'));
        const rows = snap.docs.map(d => {
          const u = d.data() || {};
          return {
            id: d.id,
            name: u.displayName || u.email || 'Anonymous',
            photoURL: u.photoURL || null,
            totalDonated: Number(u.totalDonated || 0),
            helpedCount: Array.isArray(u.helpedRecipientIds) ? u.helpedRecipientIds.length : Number(u.uniqueHelped || 0) || 0,
          };
        })
        .filter(r => (r.totalDonated || 0) > 0)
        .sort((a, b) => b.totalDonated - a.totalDonated);

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
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-(--hover-bg) active:scale-95 transition-all"
            aria-label="Go back"
          >
            <ArrowBackIcon />
          </button>
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
