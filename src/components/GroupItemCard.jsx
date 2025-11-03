import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { arrayRemove, arrayUnion, doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShareIcon from '@mui/icons-material/Share';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import PersonIcon from '@mui/icons-material/Person';
import { db } from '../config/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { saveItem, unsaveItem, isItemSaved } from '../utils/savedItems';
import { createNotification, createOrGroupLikeNotification } from '../utils/notifications';
import FlagIcon from '@mui/icons-material/Flag';
import { formatCurrencyShort } from '../utils/numberFormat';
import { reportContent } from '../utils/reports';

/**
 * Unified card for group posts and group campaign shares
 * @param {Object} item - Group post/campaign item
 * @param {string} item.type - 'post' or 'campaign'
 * @param {string} item.groupId - Group ID
 * @param {string} item.campaignId - Campaign ID (if type === 'campaign')
 */
const GroupItemCard = ({ item }) => {
  const { currentUser } = useAuth();
  const [groupName, setGroupName] = useState('Group');
  const [campaign, setCampaign] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const queryClient = useQueryClient();

  const isCampaignShare = item.type === 'campaign';

  // Fetch group name and campaign (if campaign share)
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        // Fetch group and campaign separately and only if IDs are present
        let groupSnap = null;
        let campaignSnap = null;
        if (item?.groupId) {
          groupSnap = await getDoc(doc(db, 'groups', String(item.groupId)));
        }
        if (isCampaignShare && item?.campaignId) {
          campaignSnap = await getDoc(doc(db, 'posts', String(item.campaignId)));
        }
        
        if (!mounted) return;
        if (groupSnap?.exists()) setGroupName(groupSnap.data().name || 'Group');
        if (campaignSnap?.exists()) {
          const data = { id: campaignSnap.id, ...campaignSnap.data() };
          setCampaign(data);
          setIsLiked(data.likedBy?.includes(currentUser?.uid) || false);
          setLikesCount(data.likesCount || 0);
          setSharesCount(data.sharesCount || 0);
        } else if (!isCampaignShare) {
          setIsLiked(item.likedBy?.includes(currentUser?.uid) || false);
          setLikesCount(item.likesCount || 0);
          setSharesCount(item.sharesCount || 0);
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
    return () => { mounted = false; };
  }, [item.groupId, item.campaignId, isCampaignShare, currentUser?.uid, item.likedBy, item.likesCount, item.sharesCount]);

  // Check saved status
  useEffect(() => {
    const checkSaved = async () => {
      if (!currentUser) return;
      const itemId = isCampaignShare && campaign ? campaign.id : item.id;
      if (itemId) {
        const saved = await isItemSaved(currentUser.uid, itemId);
        setIsSaved(saved);
      }
    };
    checkSaved();
  }, [currentUser, item.id, campaign, isCampaignShare]);

  const timeAgo = (ts) => {
    if (!ts) return 'Just now';
    const date = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    const diffMs = Date.now() - date;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const targetRef = useMemo(() => {
    if (isCampaignShare) {
      if (campaign?.id) return doc(db, 'posts', String(campaign.id));
      return null;
    }
    if (item?.groupId && item?.id) return doc(db, 'groups', String(item.groupId), 'posts', String(item.id));
    return null;
  }, [isCampaignShare, campaign?.id, item.groupId, item.id]);

  const handleLike = async () => {
    if (!currentUser) { alert('Please log in to like'); return; }
    try {
      if (!targetRef) throw new Error('Invalid document reference');
      if (isLiked) {
        await updateDoc(targetRef, { likedBy: arrayRemove(currentUser.uid), likesCount: increment(-1) });
        setIsLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await updateDoc(targetRef, { likedBy: arrayUnion(currentUser.uid), likesCount: increment(1) });
        setIsLiked(true);
        setLikesCount((c) => c + 1);
        // Notify the content owner (best-effort)
        try {
          const ownerId = isCampaignShare && campaign ? campaign.authorId : item.authorId;
          if (ownerId && ownerId !== currentUser.uid) {
            await createOrGroupLikeNotification(ownerId, {
              senderId: currentUser.uid,
              senderName: currentUser.displayName || 'Someone',
              postId: isCampaignShare && campaign ? campaign.id : item.id,
              postTitle: isCampaignShare && campaign ? campaign.title : ''
            });
          }
        } catch {/* non-fatal */}
      }
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    try {
      if (!targetRef) throw new Error('Invalid document reference');
      await updateDoc(targetRef, { sharesCount: increment(1) });
      setSharesCount((c) => c + 1);
      const url = isCampaignShare && campaign
        ? `${window.location.origin}/post/${campaign.id}`
        : `${window.location.origin}/group/${item.groupId}`;
      const title = isCampaignShare && campaign ? campaign.title : groupName;
      const text = isCampaignShare && campaign ? campaign.description : item.content;
      if (navigator.share) await navigator.share({ title, text, url });
      else { await navigator.clipboard.writeText(url); alert('Link copied to clipboard'); }
      // Notify the content owner (best-effort)
      try {
        const ownerId = isCampaignShare && campaign ? campaign.authorId : item.authorId;
        if (ownerId && ownerId !== currentUser.uid) {
          await createNotification(ownerId, 'share', {
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Someone',
            postId: isCampaignShare && campaign ? campaign.id : item.id,
            postTitle: isCampaignShare && campaign ? campaign.title : ''
          });
        }
      } catch {/* non-fatal */}
    } catch (e) { if (e.name !== 'AbortError') console.error(e); }
  };

  const handleSave = async () => {
    if (!currentUser) { alert('Please log in to save'); return; }
    try {
      if (isSaved) {
        const itemId = isCampaignShare && campaign ? campaign.id : item.id;
        await unsaveItem(currentUser.uid, itemId);
        setIsSaved(false);
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      } else {
        if (isCampaignShare && campaign) {
          await saveItem(currentUser.uid, campaign.id, (campaign.groupId ? 'group_campaign' : 'campaign'), {
            title: campaign.title,
            description: campaign.description,
            imageUrl: campaign.imageUrl,
            authorId: campaign.authorId,
            authorName: campaign.authorName,
            groupId: campaign.groupId || item.groupId || null,
          });
        } else {
          await saveItem(currentUser.uid, item.id, 'post', {
            title: item.content?.slice(0, 100) || 'Group post',
            description: item.content || '',
            imageUrl: item.imageUrl || '',
            authorId: item.authorId,
            authorName: item.authorName,
            groupId: item.groupId,
          });
        }
        setIsSaved(true);
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      }
    } catch (e) { console.error(e); }
  };

  const handleReport = async () => {
    if (!currentUser) { alert('Please log in to report'); return; }
    const reason = window.prompt('Report reason (spam, inappropriate, misleading, other):', 'spam');
    if (reason === null) return;
    const comment = window.prompt('Optional details (leave blank if none):', '') || '';
    try {
      if (isCampaignShare && campaign) {
        await reportContent({
          targetType: 'campaign',
          targetId: campaign.id,
          reportedById: currentUser.uid,
          reportedByName: currentUser.displayName || 'User',
          reason: String(reason || 'other').toLowerCase(),
          comment,
          meta: { authorId: campaign.authorId || null, groupId: item.groupId || null, title: campaign.title || '' },
        });
      } else {
        await reportContent({
          targetType: 'group_post',
          targetId: item.id,
          reportedById: currentUser.uid,
          reportedByName: currentUser.displayName || 'User',
          reason: String(reason || 'other').toLowerCase(),
          comment,
          meta: { authorId: item.authorId || null, groupId: item.groupId || null },
        });
      }
      alert('Thanks for your report. Our moderators will review it.');
    } catch (err) {
      console.error('Failed to submit report', err);
      alert('Failed to submit report. Please try again.');
    }
  };

  // Campaign share rendering
  if (isCampaignShare) {
    if (!campaign) return null;
    const progress = campaign.goalAmount ? (campaign.currentAmount / campaign.goalAmount) * 100 : 0;

    return (
      <div className="card overflow-hidden hover:shadow-lg transition-all duration-300 md:hover:-translate-y-1 animate-fade-in">
        <div className="p-3 md:p-4">
          <div className="text-xs mb-2">
            <Link to={`/group/${item.groupId}`} className="text-green-600 dark:text-green-400 hover:underline">
              Shared in group: {groupName}
            </Link>
          </div>
          <h3 className="text-lg font-semibold text-themed">{campaign.title}</h3>
          <p className="mt-1 text-sm text-themed-secondary line-clamp-3">{campaign.description}</p>
        </div>
        {campaign.imageUrl && (
          <Link to={`/post/${campaign.id}`} className="block overflow-hidden">
            <img src={campaign.imageUrl} alt={campaign.title} className="w-full max-h-96 object-cover transition-transform duration-500 hover:scale-105" />
          </Link>
        )}
        <div className="px-3 md:px-4 py-3">
          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="flex justify-between items-center mt-2 text-xs md:text-sm">
            <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrencyShort(campaign.currentAmount || 0, { maxDigits: 5 })}</span>
            <span className="text-themed-muted">{formatCurrencyShort(campaign.goalAmount || 0, { maxDigits: 5 })}</span>
          </div>
        </div>
        <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-6">
            <button onClick={handleLike} className={`flex items-center space-x-1 bg-transparent hover:bg-transparent focus:bg-transparent ${isLiked ? 'text-red-600' : 'text-themed-secondary hover:text-red-500'}`}>
              {isLiked ? <FavoriteIcon className="text-sm md:text-base" /> : <FavoriteBorderIcon className="text-sm md:text-base" />}
              <span className="text-xs md:text-sm font-medium">{likesCount}</span>
            </button>
            <Link to={`/post/${campaign.id}`} className="flex items-center space-x-1 text-themed-secondary hover:text-blue-500">
              <ChatBubbleOutlineIcon className="text-sm md:text-base" />
              <span className="text-xs md:text-sm font-medium">{campaign.updateCount || 0}</span>
            </Link>
            <button onClick={handleShare} className="flex items-center space-x-1 text-themed-secondary hover:text-green-500">
              <ShareIcon className="text-sm md:text-base" />
              <span className="text-xs md:text-sm font-medium">{sharesCount}</span>
            </button>
            <button onClick={handleSave} className={`flex items-center space-x-1 ${isSaved ? 'text-yellow-500' : 'text-themed-secondary hover:text-yellow-500'}`}>
              {isSaved ? <BookmarkIcon className="text-sm md:text-base" /> : <BookmarkBorderIcon className="text-sm md:text-base" />}
            </button>
            <button onClick={handleReport} className="flex items-center space-x-1 text-themed-secondary hover:text-red-600">
              <FlagIcon className="text-sm md:text-base" />
            </button>
          </div>
          <Link to={`/post/${campaign.id}`} className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs md:text-sm font-medium">
            Help Now
          </Link>
        </div>
      </div>
    );
  }

  // Regular group post rendering
  return (
    <div className="card overflow-hidden hover:shadow-lg transition-all duration-300 md:hover:-translate-y-1 animate-fade-in">
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/profile/${item.authorId}`}
            className="avatar-link w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden hover:opacity-90"
            title={`View ${item.authorName || 'profile'}`}
          >
            {item.authorPhoto ? (
              <img src={item.authorPhoto} alt={item.authorName} className="w-10 h-10 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <PersonIcon className="text-gray-600 dark:text-gray-300" />
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${item.authorId}`} className="font-semibold text-themed text-sm hover:underline">{item.authorName || 'Anonymous'}</Link>
            <p className="text-xs text-themed-muted">{timeAgo(item.createdAt)}</p>
            <div className="text-xs mt-1">
              <Link to={`/group/${item.groupId}`} className="text-green-600 dark:text-green-400 hover:underline">
                In group: {groupName}
              </Link>
            </div>
          </div>
        </div>
        {item.content && (
          <p className="mt-3 text-sm md:text-base text-themed-secondary whitespace-pre-wrap">{item.content}</p>
        )}
      </div>
      {item.imageUrl && (
        <img src={item.imageUrl} alt="Post" className="w-full max-h-96 object-cover" />
      )}
      <div className="px-3 md:px-4 py-3 border-t border-surface flex items-center justify-between">
        <div className="flex items-center space-x-4 md:space-x-6">
          <button onClick={handleLike} className={`flex items-center space-x-1 bg-transparent hover:bg-transparent focus:bg-transparent ${isLiked ? 'text-red-600' : 'text-themed-secondary hover:text-red-500'}`}>
            {isLiked ? <FavoriteIcon className="text-sm md:text-base" /> : <FavoriteBorderIcon className="text-sm md:text-base" />}
            <span className="text-xs md:text-sm font-medium">{likesCount}</span>
          </button>
          <button onClick={handleShare} className="flex items-center space-x-1 text-themed-secondary hover:text-green-500">
            <ShareIcon className="text-sm md:text-base" />
            <span className="text-xs md:text-sm font-medium">{sharesCount}</span>
          </button>
          <button onClick={handleSave} className={`flex items-center space-x-1 ${isSaved ? 'text-yellow-500' : 'text-themed-secondary hover:text-yellow-500'}`}>
            {isSaved ? <BookmarkIcon className="text-sm md:text-base" /> : <BookmarkBorderIcon className="text-sm md:text-base" />}
          </button>
            <button onClick={handleReport} className="flex items-center space-x-1 text-themed-secondary hover:text-red-600">
              <FlagIcon className="text-sm md:text-base" />
            </button>
        </div>
        <Link to={`/group/${item.groupId}`} className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs md:text-sm font-medium">
          View Group
        </Link>
      </div>
    </div>
  );
};

export default GroupItemCard;
