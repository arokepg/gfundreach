import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, collectionGroup, where, getDocs, query } from 'firebase/firestore';
import { saveItem, unsaveItem, isItemSaved } from '../../utils/savedItems';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification, createOrGroupLikeNotification } from '../../utils/notifications';
import Layout from '../../components/Layout';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CampaignIcon from '@mui/icons-material/Campaign';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';

const CommunityPostDetail = () => {
  const { campaignId, postId } = useParams();
  const [post, setPost] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchPostAndCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, postId]);

  const fetchPostAndCampaign = async () => {
    try {
      setLoading(true);
      
      // Fetch the community post
      let postDoc = await getDoc(doc(db, 'posts', campaignId, 'updates', postId));
      if (!postDoc.exists()) {
        // Fallback: find the update by ID across all campaigns
        try {
          const q = query(collectionGroup(db, 'updates'), where('__name__', '==', postId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0];
            postDoc = d; // Use this doc
            // derive campaignId from parent
            const parentCampaignId = d.ref.parent.parent.id;
            if (campaignId !== parentCampaignId) {
              // Navigate to canonical URL for consistency
              navigate(`/community-post/${parentCampaignId}/${postId}`, { replace: true });
              return;
            }
          } else {
            setError('Post not found');
            return;
          }
        } catch {
          setError('Post not found');
          return;
        }
      }

  const postData = { id: postDoc.id, ...postDoc.data() };
      setPost(postData);
  // Initialize reactions
  const likedBy = Array.isArray(postData.likedBy) ? postData.likedBy : [];
  setIsLiked(currentUser ? likedBy.includes(currentUser.uid) : false);
  setLikesCount(typeof postData.likesCount === 'number' ? postData.likesCount : likedBy.length || 0);
  setSharesCount(typeof postData.sharesCount === 'number' ? postData.sharesCount : 0);

      // Saved status
      try {
        if (currentUser && postDoc.id) {
          const saved = await isItemSaved(currentUser.uid, postDoc.id);
          setIsSaved(saved);
        }
      } catch (err) {
        console.warn('Failed to check saved status', err);
      }

      // Fetch the parent campaign
  const campaignDoc = await getDoc(doc(db, 'posts', campaignId));
      if (campaignDoc.exists()) {
        setCampaign({ id: campaignDoc.id, ...campaignDoc.data() });
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    if (!currentUser) {
      alert('Please log in to like this post');
      return;
    }
    try {
      const ref = doc(db, 'posts', campaignId, 'updates', postId);
      if (isLiked) {
        await updateDoc(ref, { likedBy: arrayRemove(currentUser.uid), likesCount: increment(-1) });
        setIsLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await updateDoc(ref, { likedBy: arrayUnion(currentUser.uid), likesCount: increment(1) });
        setIsLiked(true);
        setLikesCount((c) => c + 1);
        // Best-effort: notify post author about like
        try {
          if (post?.authorId && currentUser.uid !== post.authorId) {
            await createOrGroupLikeNotification(post.authorId, {
              senderId: currentUser.uid,
              senderName: currentUser.displayName || 'Someone',
              postId: post.id,
              postTitle: campaign?.title || ''
            });
          }
        } catch {/* non-fatal */}
      }
    } catch (err) {
      console.error('Toggle like failed', err);
    }
  };

  const sharePost = async () => {
    if (!post) return;
    const ref = doc(db, 'posts', campaignId, 'updates', postId);
    try {
      try {
        await updateDoc(ref, { sharesCount: increment(1) });
        setSharesCount((c) => c + 1);
      } catch (e) {
        console.warn('Share increment failed (non-fatal):', e);
      }
      const url = `${window.location.origin}/community-post/${campaignId}/${postId}`;
      if (navigator.share) {
        await navigator.share({ title: campaign?.title || 'Community post', text: post.content, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      }
      // Best-effort: notify post author about share
      try {
        if (post?.authorId && currentUser?.uid !== post.authorId) {
          await createNotification(post.authorId, 'share', {
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Someone',
            postId: post.id,
            postTitle: campaign?.title || ''
          });
        }
      } catch {/* non-fatal */}
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed', err);
    }
  };

  const toggleSave = async () => {
    if (!post) return;
    if (!currentUser) {
      alert('Please log in to save this post');
      return;
    }
    try {
      if (isSaved) {
        await unsaveItem(currentUser.uid, post.id);
        setIsSaved(false);
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      } else {
        await saveItem(currentUser.uid, post.id, (campaign?.groupId ? 'group_community_post' : 'community_post'), {
          title: post.content?.slice(0, 100) || 'Community post',
          description: post.content || '',
          imageUrl: post.imageUrl || '',
          authorId: post.authorId,
          authorName: post.authorName,
          campaignId: campaignId,
          groupId: campaign?.groupId || null,
        });
        setIsSaved(true);
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      }
    } catch (err) {
      console.error('Toggle save failed', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <div className="card p-8 text-center">
            <h2 className="text-2xl font-bold text-themed mb-4">{error || 'Post not found'}</h2>
            <button
              onClick={() => navigate(-1)}
              className="btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
  <Layout>
      <div className="max-w-4xl mx-auto p-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-themed-secondary hover:text-themed mb-4 transition-colors"
        >
          <ArrowBackIcon />
          <span>Back</span>
        </button>

        {/* Post Card */}
        <div className="card p-6 mb-6">
          {/* Parent Campaign Info */}
          {campaign && (
            <Link 
              to={`/post/${campaignId}`}
              className="flex items-center gap-3 p-4 mb-6 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--hover-bg)' }}
            >
              <CampaignIcon className="text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-themed-muted">Community post from campaign</p>
                <p className="font-semibold text-themed truncate">{campaign.title}</p>
              </div>
              <span className="text-xs text-green-600 font-medium">View Campaign →</span>
            </Link>
          )}

          {/* Post Header */}
          <div className="flex items-start gap-4 mb-6">
            <Link to={`/profile/${post.authorId}`} className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-90">
              {post.authorPhoto ? (
                <img
                  src={post.authorPhoto}
                  alt={post.authorName}
                  className="w-12 h-12 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <PersonIcon className="text-gray-600 dark:text-gray-300" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/profile/${post.authorId}`} className="font-semibold text-themed text-lg hover:underline">{post.authorName || 'Anonymous'}</Link>
              {post.createdAt && (
                <p className="text-sm text-themed-muted">
                  {post.createdAt.toDate ? post.createdAt.toDate().toLocaleString() : new Date(post.createdAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Post Content */}
          <div className="mb-6">
            <p className="text-themed whitespace-pre-wrap text-lg leading-relaxed">{post.content}</p>
          </div>

          {/* Post Image */}
          {post.imageUrl && (
            <div className="mb-6">
              <img
                src={post.imageUrl}
                alt="Post attachment"
                className="rounded-lg w-full max-h-[600px] object-contain"
                style={{ backgroundColor: 'var(--card-bg)' }}
              />
            </div>
          )}

          {/* Reactions */}
          <div className="pt-6 border-t border-outline-variant">
            <div className="flex items-center gap-6 mb-4">
              <button
                onClick={toggleLike}
                className={`flex items-center gap-2 bg-transparent hover:bg-transparent focus:bg-transparent transition-colors ${
                  isLiked ? 'text-red-600' : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
                }`}
              >
                {isLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                <span className="text-sm font-medium">{likesCount}</span>
              </button>
              <button
                onClick={sharePost}
                className="flex items-center gap-2 text-themed-secondary hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                <ShareIcon />
                <span className="text-sm font-medium">{sharesCount}</span>
              </button>
              <button
                onClick={toggleSave}
                className={`p-2 rounded-lg transition-colors ${
                  isSaved
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-themed-secondary hover:text-yellow-600 dark:hover:text-yellow-400'
                }`}
                title={isSaved ? 'Remove bookmark' : 'Bookmark'}
              >
                {isSaved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-themed-muted">
              <span>Community Post</span>
              {post.createdAt && (
                <span>
                  Posted on {post.createdAt.toDate ? 
                    post.createdAt.toDate().toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 
                    new Date(post.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Campaign Button */}
        {campaign && (
          <div className="card p-6 text-center">
            <h3 className="text-lg font-semibold text-themed mb-2">Want to learn more?</h3>
            <p className="text-themed-muted mb-4">View the full campaign and see other community posts</p>
            <Link
              to={`/post/${campaignId}`}
              className="btn-primary inline-block"
            >
              View Campaign: {campaign.title}
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CommunityPostDetail;
