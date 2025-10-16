import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const RightSidebar = () => {
  const [topDonators, setTopDonators] = useState([]);
  const [trendingCategories, setTrendingCategories] = useState([]);

  useEffect(() => {
    fetchTopDonators();
    fetchTrendingCategories();
  }, []);

  const fetchTopDonators = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('totalDonated', 'desc'),
        limit(3)
      );
      const snapshot = await getDocs(q);
      const donators = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTopDonators(donators);
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

  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Donators */}
  <div className="card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <EmojiEventsIcon className="text-green-600" />
          <h3 className="text-lg font-bold text-themed">Top Donators</h3>
        </div>
        <div className="space-y-4">
          {topDonators.map((donator, index) => (
            <div key={donator.id} className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
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
      </div>

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
