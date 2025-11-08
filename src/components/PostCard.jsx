import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createOrGroupLikeNotification } from '../utils/notifications';
import { saveItem, unsaveItem, isItemSaved } from '../utils/savedItems';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShareIcon from '@mui/icons-material/Share';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VerifiedIcon from '@mui/icons-material/Verified';
import FlagIcon from '@mui/icons-material/Flag';
import { formatCurrencyShort } from '../utils/numberFormat';
import ShareToChatModal from './ShareToChatModal';
import { reportContent } from '../utils/reports';

const PostCard = ({ post }) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [isLiked, setIsLiked] = useState(post.likedBy?.includes(currentUser?.uid) || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const sharesCount = post.sharesCount || 0;
  const [isSaved, setIsSaved] = useState(false);
  const progress = post.goalAmount ? (post.currentAmount / post.goalAmount) * 100 : 0;
  const isCompleted = (post.currentAmount || 0) >= (post.goalAmount || Infinity);
  const [groupName, setGroupName] = useState('');
  const [openShare, setOpenShare] = useState(false);
  const [authorVerified, setAuthorVerified] = useState(false);

  // Fetch author verification status
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!post.authorId) return;
        const snap = await getDoc(doc(db, 'users', String(post.authorId)));
        if (mounted && snap.exists()) {
          setAuthorVerified(snap.data().verified === true);
        }
      } catch (err) {
        // non-fatal - may fail if user is not signed in or has insufficient permissions
        console.warn('Could not fetch author verification status:', err.message);
      }
    })();
    return () => { mounted = false; };
  }, [post.authorId]);

  // Fetch group name for group campaigns
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!post.groupId) return;
        const snap = await getDoc(doc(db, 'groups', String(post.groupId)));
        if (mounted && snap.exists()) setGroupName(snap.data().name || 'Group');
      } catch {
        // non-fatal
      }
    })();
    return () => { mounted = false; };
  }, [post.groupId]);

  // Check if post is saved
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (currentUser && post.id) {
        const saved = await isItemSaved(currentUser.uid, post.id);
        setIsSaved(saved);
      }
    };
    checkSavedStatus();
  }, [currentUser, post.id]);
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

  const handleLike = async (e) => {
    e.stopPropagation();
    
    if (!currentUser) {
      alert('Please log in to like this campaign');
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      
      if (isLiked) {
        // Unlike
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1),
        });
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        // Like
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1),
        });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);

        // Create grouped like notification for post owner
        await createOrGroupLikeNotification(post.authorId, {
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
          postId: post.id,
          postTitle: post.title
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    setOpenShare(true);
  };

  const handleReport = async (e) => {
    e.stopPropagation();
    if (!currentUser) { alert('Please log in to report'); return; }
    const reason = window.prompt('Report reason (spam, inappropriate, misleading, other):', 'spam');
    if (reason === null) return; // cancelled
    const comment = window.prompt('Optional details (leave blank if none):', '') || '';
    try {
      await reportContent({
        targetType: 'campaign',
        targetId: post.id,
        reportedById: currentUser.uid,
        reportedByName: userProfile?.displayName || currentUser.displayName || 'User',
        reason: String(reason || 'other').toLowerCase(),
        comment,
        meta: { authorId: post.authorId || null, groupId: post.groupId || null, title: post.title || '' },
      });
      alert('Thanks for your report. Our moderators will review it.');
    } catch (err) {
      console.error('Failed to submit report', err);
      alert('Failed to submit report. Please try again.');
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    
    if (!currentUser) {
      alert('Please log in to save this campaign');
      return;
    }

    try {
      if (isSaved) {
        // Unsave
        const result = await unsaveItem(currentUser.uid, post.id);
        if (result.success) {
          setIsSaved(false);
        } else {
          console.error('Failed to unsave:', result.error);
          alert('Failed to remove bookmark. Please try again.');
        }
      } else {
        // Save
        const result = await saveItem(
          currentUser.uid,
          post.id,
          (post.groupId ? 'group_campaign' : 'campaign'),
          {
            title: post.title,
            description: post.description,
            summary: post.summary,
            imageUrl: post.imageUrl,
            image: post.image,
            authorId: post.authorId,
            authorName: post.authorName,
            displayName: post.displayName,
            userId: post.userId,
            groupId: post.groupId || null,
          }
        );
        if (result.success) {
          setIsSaved(true);
        } else {
          console.error('Failed to save:', result.error);
          alert('Failed to bookmark. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      alert('An error occurred while bookmarking. Please try again.');
    }
  };

  return (
  <>
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
      <div className="p-3 md:p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link
            to={`/profile/${post.authorId}`}
            onClick={(e) => e.stopPropagation()}
            title={`View ${post.authorName || 'profile'}`}
            className="avatar-link w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full overflow-hidden transition-transform duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 shrink-0"
          >
            <img
              src={post.authorPhoto || 'https://via.placeholder.com/40'}
              alt={post.authorName}
              className="w-full h-full object-cover"
            />
          </Link>
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 md:gap-1">
            <div className="flex items-center gap-1 md:gap-1.5">
              <Link
                to={`/profile/${post.authorId}`}
                className="font-semibold text-xs sm:text-sm md:text-base text-themed hover:underline truncate block leading-tight"
                onClick={(e) => e.stopPropagation()}
              >
                {post.authorName}
              </Link>
              {authorVerified && (
                <VerifiedIcon className="text-blue-500 shrink-0" sx={{ fontSize: { xs: 14, sm: 16 } }} titleAccess="Verified User" />
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-themed-muted truncate leading-tight">
              {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2 flex-shrink-0">
          {authorVerified && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <VerifiedIcon className="text-blue-600" style={{ fontSize: 14 }} />
              <span className="text-xs font-medium text-blue-600 whitespace-nowrap">Verified User</span>
            </div>
          )}
          {post.priority && (
            <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getPriorityColor(post.priority)} whitespace-nowrap`}>
              {post.priority === 'high' ? 'Need Help' : post.priority === 'low' ? 'Low Priority' : 'High Priority'}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <Link to={`/post/${post.id}`} className="block px-3 md:px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-themed font-semibold mb-2 line-clamp-2 text-sm md:text-base leading-tight">
          {post.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {post.category && (
            <span className="text-xs md:text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">
              #{post.category}
            </span>
          )}
          {post.groupId && (
            <Link
              to={`/group/${post.groupId}`}
              onClick={(e)=> e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:underline font-medium max-w-full"
              title={groupName || 'Group'}
            >
              <span className="flex-shrink-0">Group:</span>
              <span className="truncate">{groupName || 'Group'}</span>
            </Link>
          )}
        </div>
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
        <div className="px-3 md:px-4 py-2 flex items-center gap-1 text-xs md:text-sm text-themed-secondary">
          <LocationOnIcon fontSize="small" className="flex-shrink-0" />
          <span className="truncate">{post.location}</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="px-3 md:px-4 py-3">
        <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${isCompleted ? 'bg-blue-600 progress-animated' : 'bg-green-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2 gap-2">
          <span className={`text-xs md:text-sm font-semibold ${isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'} truncate`}>
            {formatCurrencyShort(post.currentAmount || 0, { maxDigits: 5 })} {isCompleted && <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 align-middle whitespace-nowrap">Completed</span>}
          </span>
          <span className="text-xs md:text-sm text-themed-muted flex-shrink-0">
            {formatCurrencyShort(post.goalAmount || 0, { maxDigits: 5 })}
          </span>
        </div>
      </div>

      {/* Actions */}
  <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1 bg-transparent hover:bg-transparent focus:bg-transparent transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 flex-shrink-0 ${
              isLiked 
                ? 'text-red-600' 
                : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
            }`}
          >
            {isLiked ? (
              <FavoriteIcon fontSize="small" />
            ) : (
              <FavoriteBorderIcon fontSize="small" />
            )}
            <span className="text-xs sm:text-sm font-medium">{likesCount}</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigateToPost();
            }}
            className="flex items-center gap-1 text-themed-secondary hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 flex-shrink-0"
          >
            <ChatBubbleOutlineIcon fontSize="small" />
            <span className="text-xs sm:text-sm font-medium">{post.updateCount || 0}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1 text-themed-secondary hover:text-green-500 dark:hover:text-green-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 flex-shrink-0"
          >
            <ShareIcon fontSize="small" />
            <span className="text-xs sm:text-sm font-medium">{sharesCount}</span>
          </button>
          <button 
            onClick={handleSave}
            className={`flex items-center gap-1 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 flex-shrink-0 ${
              isSaved
                ? 'text-yellow-500'
                : 'text-themed-secondary hover:text-yellow-500 dark:hover:text-yellow-400'
            }`}
          >
            {isSaved ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </button>
          <button
            onClick={handleReport}
            className="flex items-center gap-1 text-themed-secondary hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 flex-shrink-0"
            title="Report"
          >
            <FlagIcon fontSize="small" />
          </button>
        </div>
        <Link
          to={`/post/${post.id}`}
          className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-medium transition-all duration-300 hover:shadow-lg active:scale-95 md:hover:-translate-y-0.5 md:active:translate-y-0 whitespace-nowrap flex-shrink-0 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          Help Now
        </Link>
      </div>
    </div>
    <ShareToChatModal open={openShare} onClose={() => setOpenShare(false)} post={post} />
  </>
  );
};

export default PostCard;
