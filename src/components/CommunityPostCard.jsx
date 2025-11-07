import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
  updateDoc
} from 'firebase/firestore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import ShareToChatModal from './ShareToChatModal';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedIcon from '@mui/icons-material/Verified';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { saveItem, unsaveItem, isItemSaved } from '../utils/savedItems';
import FlagIcon from '@mui/icons-material/Flag';
import { reportContent } from '../utils/reports';

// Contract
// props.post: {
//   id: string (update id),
//   campaignId: string,
//   content: string,
//   imageUrl?: string,
//   authorId, authorName, authorPhoto,
//   createdAt: Timestamp|number|Date,
//   likedBy?: string[], likesCount?: number, sharesCount?: number,
// }

const CommunityPostCard = ({ post }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [isLiked, setIsLiked] = useState(post.likedBy?.includes(currentUser?.uid) || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const sharesCount = post.sharesCount || 0;
  const [isSaved, setIsSaved] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState(post.campaignTitle || 'Campaign');
  const [openShare, setOpenShare] = useState(false);
  const [authorVerified, setAuthorVerified] = useState(false);

  // Fetch author verification status
  useEffect(() => {
    let mounted = true;
    const fetchAuthor = async () => {
      try {
        if (!post.authorId) return;
        const snap = await getDoc(doc(db, 'users', post.authorId));
        if (mounted && snap.exists()) {
          setAuthorVerified(snap.data().verified === true);
        }
      } catch (err) {
        // non-fatal - may fail if user is not signed in or has insufficient permissions
        console.warn('Could not fetch author verification status:', err.message);
      }
    };
    fetchAuthor();
    return () => { mounted = false; };
  }, [post.authorId]);

  // Ensure we have campaign title
  useEffect(() => {
    let mounted = true;
    const fetchCampaign = async () => {
      try {
        if (!post.campaignId) return;
        const snap = await getDoc(doc(db, 'posts', post.campaignId));
        if (mounted && snap.exists()) {
          const data = snap.data();
          setCampaignTitle(data.title || 'Campaign');
        }
      } catch (err) {
        console.warn('Failed to fetch parent campaign for community post card', err);
      }
    };
    if (!post.campaignTitle) fetchCampaign();
    return () => { mounted = false; };
  }, [post.campaignId, post.campaignTitle]);

  // Saved status
  useEffect(() => {
    const checkSaved = async () => {
      if (currentUser && post.id) {
        const saved = await isItemSaved(currentUser.uid, post.id);
        setIsSaved(saved);
      }
    };
    checkSaved();
  }, [currentUser, post.id]);

  const timeAgo = (ts) => {
    if (!ts) return 'Just now';
    const date = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    const now = new Date();
    const diffMs = now - date;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const navigateToDetail = () => {
    if (post?.campaignId && post?.id) {
      navigate(`/community-post/${post.campaignId}/${post.id}`);
    }
  };

  const updateDocRef = useMemo(() => doc(collection(doc(db, 'posts', post.campaignId), 'updates'), post.id), [post.campaignId, post.id]);

  const handleLike = async (e) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to like this post');
      return;
    }
    try {
      if (isLiked) {
        await updateDoc(updateDocRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1),
        });
        setIsLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await updateDoc(updateDocRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1),
        });
        setIsLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Toggle like failed', err);
    }
  };

  const handleShare = (e) => {
    if (e) e.stopPropagation();
    setOpenShare(true);
  };

  const handleSave = async (e) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to save this post');
      return;
    }
    try {
      if (isSaved) {
        await unsaveItem(currentUser.uid, post.id);
        setIsSaved(false);
      } else {
        await saveItem(currentUser.uid, post.id, 'post', {
          title: post.content?.slice(0, 100) || 'Community post',
          description: post.content || '',
          imageUrl: post.imageUrl || '',
          authorId: post.authorId,
          authorName: post.authorName,
          campaignId: post.campaignId,
        });
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Toggle save failed', err);
    }
  };

  const handleReport = async (e) => {
    if (e) e.stopPropagation();
    if (!currentUser) { alert('Please log in to report'); return; }
    const reason = window.prompt('Report reason (spam, inappropriate, misleading, other):', 'spam');
    if (reason === null) return;
    const comment = window.prompt('Optional details (leave blank if none):', '') || '';
    try {
      await reportContent({
        targetType: 'community_post',
        targetId: post.id,
        reportedById: currentUser.uid,
        reportedByName: currentUser.displayName || 'User',
        reason: String(reason || 'other').toLowerCase(),
        comment,
        meta: { campaignId: post.campaignId || null, authorId: post.authorId || null },
      });
      alert('Thanks for your report. Our moderators will review it.');
    } catch (err) {
      console.error('Failed to submit report', err);
      alert('Failed to submit report. Please try again.');
    }
  };

  return (
    <>
    <div
      className="card overflow-hidden hover:shadow-lg transition-all duration-300 md:hover:-translate-y-1 animate-fade-in cursor-pointer"
      onClick={navigateToDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateToDetail();
        }
      }}
    >
      {/* Header */}
      <div className="p-3 md:p-4 flex items-start justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <Link
            to={`/profile/${post.authorId}`}
            className="avatar-link w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            title={`View ${post.authorName || 'profile'}`}
          >
            {post.authorPhoto ? (
              <img src={post.authorPhoto} alt={post.authorName} className="w-10 h-10 object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
            ) : (
              <PersonIcon className="text-gray-600 dark:text-gray-300" />
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <Link
                to={`/profile/${post.authorId}`}
                className="font-semibold text-themed hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {post.authorName || 'Anonymous'}
              </Link>
              {authorVerified && (
                <VerifiedIcon className="text-blue-500 text-sm" />
              )}
            </div>
            <p className="text-xs text-themed-muted">{timeAgo(post.createdAt)}</p>
            <div className="text-xs mt-1">
              <Link
                to={`/post/${post.campaignId}`}
                className="text-green-600 dark:text-green-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                From campaign: {campaignTitle}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 md:px-4 pb-3">
        {post.content && (
          <p className="text-themed mb-2 whitespace-pre-wrap text-sm md:text-base">{post.content}</p>
        )}
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="block overflow-hidden">
          <img
            src={post.imageUrl}
            alt="Post attachment"
            className="w-full max-h-96 object-cover transition-transform duration-500 hover:scale-105"
            loading="lazy"
            decoding="async"
            sizes="(max-width: 768px) 100vw, 640px"
          />
        </div>
      )}

      {/* Actions */}
      <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between">
        <div className="flex items-center space-x-4 md:space-x-6">
          <button
            onClick={handleLike}
            className={`flex items-center space-x-1 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95 ${
              isLiked ? 'text-red-500' : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
            }`}
          >
            {isLiked ? <FavoriteIcon className="text-sm md:text-base" /> : <FavoriteBorderIcon className="text-sm md:text-base" />}
            <span className="text-xs md:text-sm font-medium">{likesCount}</span>
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
              isSaved ? 'text-yellow-500' : 'text-themed-secondary hover:text-yellow-500 dark:hover:text-yellow-400'
            }`}
          >
            {isSaved ? <BookmarkIcon className="text-sm md:text-base" /> : <BookmarkBorderIcon className="text-sm md:text-base" />}
          </button>
          <button
            onClick={handleReport}
            className="flex items-center space-x-1 text-themed-secondary hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 active:scale-110 md:hover:scale-110 md:active:scale-95"
          >
            <FlagIcon className="text-sm md:text-base" />
          </button>
        </div>
        <Link
          to={`/community-post/${post.campaignId}/${post.id}`}
          className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs md:text-sm font-medium transition-all duration-300 hover:shadow-lg active:scale-95 md:hover:-translate-y-0.5 md:active:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          View
        </Link>
      </div>
    </div>
    <ShareToChatModal open={openShare} onClose={() => setOpenShare(false)} post={{
      id: post.campaignId, // Share the campaign being discussed
      title: campaignTitle,
      description: post.content || '',
      imageUrl: post.imageUrl || '',
    }} />
    </>
  );
};

export default CommunityPostCard;
