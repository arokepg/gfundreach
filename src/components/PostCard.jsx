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

const PostCard = ({ post }) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [isLiked, setIsLiked] = useState(post.likedBy?.includes(currentUser?.uid) || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);
  const [isSaved, setIsSaved] = useState(false);
  const progress = post.goalAmount ? (post.currentAmount / post.goalAmount) * 100 : 0;
  const isCompleted = (post.currentAmount || 0) >= (post.goalAmount || Infinity);
  const [groupName, setGroupName] = useState('');

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

  const handleShare = async (e) => {
    e.stopPropagation();
    
    try {
      // Increment share count
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        sharesCount: increment(1),
      });
      setSharesCount(prev => prev + 1);

      // Share via Web Share API or copy link
      const url = `${window.location.origin}/post/${post.id}`;
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.description,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
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
        await unsaveItem(currentUser.uid, post.id);
        setIsSaved(false);
      } else {
        // Save
        await saveItem(
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
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
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
            className="w-10 h-10 rounded-full object-cover transition-transform duration-300 hover:scale-110"
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
        {post.groupId && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] md:text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 align-middle whitespace-nowrap max-w-[60%] overflow-hidden text-ellipsis">
            <span className="flex-shrink-0">Group:</span>
            <Link
              to={`/group/${post.groupId}`}
              onClick={(e)=> e.stopPropagation()}
              className="hover:underline font-medium truncate inline-block max-w-[140px]"
              title={groupName || 'Group'}
            >
              {groupName || 'Group'}
            </Link>
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
            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${isCompleted ? 'bg-blue-600 progress-animated' : 'bg-green-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className={`text-xs md:text-sm font-semibold ${isCompleted ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
            ${post.currentAmount?.toLocaleString() || 0} {isCompleted && <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 align-middle">Completed</span>}
          </span>
          <span className="text-xs md:text-sm text-themed-muted">
            ${post.goalAmount?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
  <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between">
        <div className="flex items-center space-x-4 md:space-x-6">
          <button 
            onClick={handleLike}
            className={`flex items-center space-x-1 bg-transparent hover:bg-transparent focus:bg-transparent transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 ${
              isLiked 
                ? 'text-red-600' 
                : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
            }`}
          >
            {isLiked ? (
              <FavoriteIcon className="text-sm md:text-base" />
            ) : (
              <FavoriteBorderIcon className="text-sm md:text-base" />
            )}
            <span className="text-xs md:text-sm font-medium">{likesCount}</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigateToPost();
            }}
            className="flex items-center space-x-1 text-themed-secondary hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95"
          >
            <ChatBubbleOutlineIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm font-medium">{post.updateCount || 0}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center space-x-1 text-themed-secondary hover:text-green-500 dark:hover:text-green-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95"
          >
            <ShareIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm font-medium">{sharesCount}</span>
          </button>
          <button 
            onClick={handleSave}
            className={`flex items-center space-x-1 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 ${
              isSaved
                ? 'text-yellow-500'
                : 'text-themed-secondary hover:text-yellow-500 dark:hover:text-yellow-400'
            }`}
          >
            {isSaved ? (
              <BookmarkIcon className="text-sm md:text-base" />
            ) : (
              <BookmarkBorderIcon className="text-sm md:text-base" />
            )}
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
