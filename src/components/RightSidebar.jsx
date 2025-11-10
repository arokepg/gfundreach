import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
// No longer computing wallet stats client-wide (blocked by Firestore rules for other users)
// We'll use denormalized fields on user docs instead: totalDonated and helpedRecipientIds
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { formatCurrencyShort } from '../utils/numberFormat';

const RightSidebar = () => {
  const [topDonators, setTopDonators] = useState([]);
  const [trendingCategories, setTrendingCategories] = useState([]);

  useEffect(() => {
    fetchTopDonators();
    fetchTrendingCategories();
  }, []);

  const fetchTopDonators = async () => {
    try {
      // Fetch all users first
      const snapshot = await getDocs(collection(db, 'users'));
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Use denormalized totals on user docs
      const usersWithStats = users.map(user => {
        const totalDonated = Number(user.totalDonated || 0);
        const totalHelped = Array.isArray(user.helpedRecipientIds)
          ? user.helpedRecipientIds.length
          : Number(user.uniqueHelped || 0) || 0;
        return { ...user, totalDonated, totalHelped };
      });

      // Sort by totalDonated and take top 3
      const topDonatorsList = usersWithStats
        .filter(u => (u.totalDonated || 0) > 0)
        .sort((a, b) => b.totalDonated - a.totalDonated)
        .slice(0, 3);

      setTopDonators(topDonatorsList);
    } catch (error) {
      console.error('Error fetching top donators:', error);
    }
  };

  const fetchTrendingCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'posts'));
      const posts = snapshot.docs.map(doc => doc.data());
      
      // Count posts per category
      const categoryCount = {};
      posts.forEach(post => {
        if (post.category) {
          categoryCount[post.category] = (categoryCount[post.category] || 0) + 1;
        }
      });

      // Calculate growth percentage (mock for now)
      const categories = Object.entries(categoryCount)
        .map(([name, count]) => ({
          name,
          count,
          growth: Math.floor(Math.random() * 100) // Mock growth percentage
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTrendingCategories(categories);
    } catch (error) {
      console.error('Error fetching trending categories:', error);
    }
  };

  const formatAmount = (amount) => formatCurrencyShort(amount || 0, { maxDigits: 5 });

  return (
    <div className="space-y-6">
      {/* Top Donators */}
      <Link to="/top-donors" className="block card p-6 hover:shadow-lg transition-shadow" role="button" aria-label="Top Donators">
        <div className="flex items-center space-x-2 mb-4">
          <EmojiEventsIcon className="text-green-600" />
          <h3 className="text-lg font-bold text-themed">Top Donators</h3>
        </div>
        <div className="space-y-4">
          {topDonators.map((donator, index) => (
            <div key={donator.id} className="flex items-center space-x-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-themed truncate">
                  {donator.displayName || 'Anonymous'}
                </p>
                <p className="text-xs text-themed-muted">
                  {formatAmount(donator.totalDonated || 0)} • {donator.totalHelped || 0} helped
                </p>
              </div>
            </div>
          ))}
          {topDonators.length === 0 && (
            <p className="text-sm text-themed-muted text-center py-4">
              No donations yet
            </p>
          )}
        </div>
      </Link>

      {/* Trending Categories */}
  <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUpIcon className="text-green-600" />
          <h3 className="text-lg font-bold text-themed">Trending categories</h3>
        </div>
        <div className="space-y-3">
          {trendingCategories.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-themed">
                  #{category.name}
                </p>
                <p className="text-xs text-themed-muted">
                  {category.count} posts
                </p>
              </div>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                +{category.growth}%
              </span>
            </div>
          ))}
          {trendingCategories.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No categories yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
