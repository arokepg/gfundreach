import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import HomeIcon from '@mui/icons-material/Home';

const Saved = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-6">
            <BookmarkIcon sx={{ fontSize: 80, color: '#6750A4' }} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Saved Posts</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">This feature is coming soon!</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full hover:bg-primary-dark transition-colors"
          >
            <HomeIcon />
            Back to Home
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default Saved;
