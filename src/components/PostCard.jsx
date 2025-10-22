import { Link, useNavigate } from 'react-router-dom';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShareIcon from '@mui/icons-material/Share';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VerifiedIcon from '@mui/icons-material/Verified';

const PostCard = ({ post }) => {
  const navigate = useNavigate();
  const progress = post.goalAmount ? (post.currentAmount / post.goalAmount) * 100 : 0;
  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffInHours = Math.floor((now - postDate) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return postDate.toLocaleDateString();
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-yellow-500 text-white';
    }
  };

  const navigateToPost = () => {
    // Defensive: ensure id exists
    if (post?.id) {
      navigate(`/post/${post.id}`);
    }
  };

  return (
  <div
    className="card overflow-hidden hover:shadow-lg transition-all duration-300 md:hover:-translate-y-1 animate-fade-in cursor-pointer"
    onClick={navigateToPost}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToPost();
      }
    }}
  >
      {/* Header */}
      <div className="p-3 md:p-4 flex items-start justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <img
            src={post.authorPhoto || 'https://via.placeholder.com/40'}
            alt={post.authorName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-100 transition-transform duration-300 hover:scale-110"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <Link
                to={`/profile/${post.authorId}`}
                className="font-semibold text-themed hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {post.authorName}
              </Link>
              <VerifiedIcon className="text-blue-500 text-sm" />
            </div>
            <p className="text-xs text-themed-muted">
              {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {post.priority && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(post.priority)}`}>
              {post.priority === 'high' ? 'Need Help' : post.priority === 'low' ? 'Low Priority' : 'High Priority'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <Link to={`/post/${post.id}`} className="block px-3 md:px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-themed mb-2 line-clamp-2 text-sm md:text-base">
          {post.description}
        </p>
        {post.category && (
          <span className="text-xs md:text-sm text-blue-600 dark:text-blue-400">
            #{post.category}
          </span>
        )}
      </Link>

      {/* Image */}
      {post.imageUrl && (
        <Link to={`/post/${post.id}`} className="block overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full max-h-64 md:max-h-96 object-cover transition-transform duration-500 hover:scale-105"
          />
        </Link>
      )}

      {/* Location */}
      {post.location && (
        <div className="px-3 md:px-4 py-2 flex items-center space-x-1 text-xs md:text-sm text-themed-secondary">
          <LocationOnIcon className="text-sm" />
          <span>{post.location}</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-3 md:px-4 py-3">
        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs md:text-sm font-semibold text-green-600 dark:text-green-400">
            ${post.currentAmount?.toLocaleString() || 0}
          </span>
          <span className="text-xs md:text-sm text-themed-muted">
            ${post.goalAmount?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
  <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between">
        <div className="flex items-center space-x-4 md:space-x-6">
          <button className="flex items-center space-x-1 text-themed-secondary hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95">
            <FavoriteIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm">{post.likes || 100}</span>
          </button>
          <button className="flex items-center space-x-1 text-themed-secondary hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95">
            <ChatBubbleOutlineIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm">{post.comments || 15}</span>
          </button>
          <button className="flex items-center space-x-1 text-themed-secondary hover:text-green-500 dark:hover:text-green-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95">
            <ShareIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm">{post.shares || 2}</span>
          </button>
        </div>
        <Link
          to={`/post/${post.id}`}
          className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs md:text-sm font-medium transition-all duration-300 hover:shadow-lg active:scale-95 md:hover:-translate-y-0.5 md:active:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          Help Now
        </Link>
      </div>
    </div>
  );
};

export default PostCard;
