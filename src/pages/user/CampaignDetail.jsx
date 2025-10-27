import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, updateDoc, deleteDoc, arrayUnion, arrayRemove, runTransaction, serverTimestamp, increment, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createNotification, createOrGroupLikeNotification } from '../../utils/notifications';
import Layout from '../../components/Layout';
import CampaignUpdates from '../../components/CampaignUpdates';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { recordCampaignView } from '../../utils/viewTracker';
import { getMember } from '../../utils/groups';

const CampaignDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [sharesCount, setSharesCount] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [canGroupModerate, setCanGroupModerate] = useState(false);
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Record a view once per visitor per day
  useEffect(() => {
    if (!id) return;
    recordCampaignView(id, currentUser).catch(() => {});
  }, [id, currentUser]);

  const fetchPost = async () => {
    try {
      console.log('Fetching post with id:', id);
      const postDoc = await getDoc(doc(db, 'posts', id));
      console.log('Post exists:', postDoc.exists());
      if (postDoc.exists()) {
        const postData = { id: postDoc.id, ...postDoc.data() };
        console.log('Post data:', postData);
        setPost(postData);
        // Fetch group info if applicable (non-fatal)
        try {
          if (postData.groupId) {
            const gSnap = await getDoc(doc(db, 'groups', String(postData.groupId)));
            if (gSnap.exists()) setGroupName(gSnap.data().name || 'Group');
            // Determine if current user is admin/moderator of the group (enables moderation)
            if (currentUser) {
              try {
                const member = await getMember(String(postData.groupId), currentUser.uid);
                const role = member?.role;
                setCanGroupModerate(role === 'admin' || role === 'moderator');
              } catch { setCanGroupModerate(false); }
            } else {
              setCanGroupModerate(false);
            }
          } else {
            setGroupName('');
            setCanGroupModerate(false);
          }
        } catch {/* non-fatal */}
        
        // Initialize reaction states
        const likedBy = postData.likedBy || [];
        setIsLiked(currentUser ? likedBy.includes(currentUser.uid) : false);
        setLikesCount(postData.likesCount || 0);
        setSharesCount(postData.sharesCount || 0);
      } else {
        console.log('Post not found');
        setError('Post not found');
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Failed to fetch post: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(donationAmount);
    if (!amount || amount <= 0) {
      setError('Please enter a valid donation amount');
      return;
    }

    if (userProfile.walletBalance < amount) {
      setError('Insufficient wallet balance. Please top up your wallet first.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setDonating(true);

      // Donation limits: allow slight over-goal margin
      // Margin policy: min $1, up to 5% of goal, capped at $50
      const limits = (p) => {
        const goal = Number(p?.goalAmount || 0);
        const current = Number(p?.currentAmount || 0);
        const margin = Math.max(1, Math.min(goal * 0.05, 50));
        const maxTotal = goal + margin;
        const maxDonation = Math.max(0, +(maxTotal - current).toFixed(2));
        return { goal, current, margin, maxTotal, maxDonation };
      };

      // 1) Transactional core updates to enforce cap atomically
      let thresholdCrossed = false;
      await runTransaction(db, async (tx) => {
  const postRef = doc(db, 'posts', id);
  const donorRef = doc(db, 'users', currentUser.uid);

        const [postSnap, donorSnap] = await Promise.all([
          tx.get(postRef),
          tx.get(donorRef)
        ]);

        if (!postSnap.exists()) throw new Error('Campaign not found');
        if (!donorSnap.exists()) throw new Error('Donor profile not found');

        const pdata = postSnap.data();
        const ddata = donorSnap.data();
        const { maxDonation } = limits(pdata);

        if (maxDonation <= 0) {
          throw new Error('This campaign is fully funded and cannot accept more donations.');
        }
        if (amount > maxDonation) {
          throw new Error(`The maximum you can donate right now is $${maxDonation.toFixed(2)}.`);
        }
        if ((ddata?.walletBalance || 0) < amount) {
          throw new Error('Insufficient wallet balance. Please top up your wallet first.');
        }

        // Apply atomic updates
        const oldCurrent = Number(pdata?.currentAmount || 0);
        const newCurrent = oldCurrent + amount;
        const newSupporters = (pdata?.supporters || 0) + 1;
        tx.update(postRef, { currentAmount: newCurrent, supporters: newSupporters });
        // Detect first crossing of goal
        const goalAmt = Number(pdata?.goalAmount || 0);
        if (!Number.isNaN(goalAmt) && oldCurrent < goalAmt && newCurrent >= goalAmt) {
          thresholdCrossed = true;
        }

        tx.update(donorRef, {
          walletBalance: (ddata?.walletBalance || 0) - amount,
          totalDonated: (ddata?.totalDonated || 0) + amount,
        });

        // Recipient totals can be updated via Cloud Function or best-effort outside rules.

        // Record donation transaction with a new doc ID
        const donationRef = doc(collection(db, 'transactions'));
        tx.set(donationRef, {
          type: 'donation',
          amount,
          message,
          postId: id,
          postTitle: post.title,
          donorId: currentUser.uid,
          donorName: currentUser.displayName || 'Anonymous',
          recipientId: post.authorId,
          recipientName: post.authorName,
          createdAt: serverTimestamp(),
        });
      });

  // 2) Best-effort notifications (non-blocking)
      const bestEfforts = [];
      // Notify campaign owner
      bestEfforts.push(
        createNotification(post.authorId, 'donation', {
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
          postId: id,
          postTitle: post.title,
          amount: amount
        })
      );
      // Donor receipt notification (self)
      bestEfforts.push(
        createNotification(currentUser.uid, 'donation_receipt', {
          postId: id,
          postTitle: post.title,
          amount: amount
        })
      );
      Promise.allSettled(bestEfforts).catch(() => {});

      // 3) If campaign just completed, notify all donors
      if (thresholdCrossed) {
        try {
          const donorsSnap = await getDocs(
            query(collection(db, 'transactions'), where('postId', '==', id), where('type', '==', 'donation'))
          );
          const donorIds = Array.from(new Set(donorsSnap.docs.map(d => d.data()?.donorId).filter(Boolean)));
          await Promise.allSettled(
            donorIds.map(uid =>
              createNotification(uid, 'campaign_completed', {
                postId: id,
                postTitle: post.title,
                ownerId: post.authorId,
                goalAmount: post.goalAmount
              })
            )
          );
        } catch (e) {
          console.warn('Failed to broadcast completion notifications (non-fatal):', e);
        }
      }

      setSuccess(`Successfully donated $${amount}! Thank you for your support.`);
      setDonationAmount('');
      setMessage('');
      
      // Refresh post data (non-fatal)
      try {
        await fetchPost();
      } catch (refreshErr) {
        // Do not surface as donation failure; log and proceed
        console.warn('Post refresh after donation failed (non-fatal):', refreshErr);
      }
      
    } catch (err) {
      // If any of the core writes failed, surface an error
      setError('Failed to process donation: ' + err.message);
    } finally {
      setDonating(false);
    }
  };

  const calculateProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  const daysLeft = () => {
    if (!post?.deadline) return null;
    const end = new Date(post.deadline).getTime();
    const now = Date.now();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleLike = async () => {
    if (!currentUser) {
      alert('Please log in to like this campaign');
      return;
    }

    try {
      const postRef = doc(db, 'posts', id);
      
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
          postId: id,
          postTitle: post.title
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Failed to update like. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      // Increment share count
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        sharesCount: increment(1),
      });
      setSharesCount(prev => prev + 1);

      // Share via Web Share API or copy link
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.description,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleDeleteCampaign = async () => {
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'posts', id));
        alert('Campaign deleted successfully');
        navigate('/profile');
      } catch (error) {
        console.error('Error deleting campaign:', error);
        alert('Failed to delete campaign. Please try again.');
      }
    }
  };

  const handleEditCampaign = () => {
    navigate(`/edit-campaign/${id}`);
  };

  const isOwner = currentUser && post && currentUser.uid === post.authorId;
  const canManage = !!(isOwner || canGroupModerate);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="card p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!post || error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="card p-8 text-center">
            <p className="text-error text-lg">{error || 'Post not found'}</p>
            <button onClick={() => navigate('/')} className="btn-primary mt-4">
              Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-primary hover:underline mb-6"
        >
          <ArrowBackIcon fontSize="small" />
          Back to Home
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Post Card */}
            <div className="card p-6">
              {/* Author Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Link 
                    to={`/profile/${post.authorId}`}
                    className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  >
                    {post.authorPhoto ? (
                      <img
                        src={post.authorPhoto}
                        alt={post.authorName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <PersonIcon className="text-primary" />
                    )}
                  </Link>
                  <div>
                    <Link 
                      to={`/profile/${post.authorId}`}
                      className="font-medium text-themed hover:underline"
                    >
                      {post.authorName}
                    </Link>
                    <p className="text-sm text-themed-muted">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Campaign Management Buttons - Visible to owner or group admin/moderator */}
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/campaign-stats/${id}`)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md flex items-center justify-center"
                      title="View Statistics"
                    >
                      <BarChartIcon style={{ fontSize: '20px' }} />
                    </button>
                    <button
                      onClick={handleEditCampaign}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md flex items-center justify-center"
                      title="Edit Campaign"
                    >
                      <EditIcon style={{ fontSize: '20px' }} />
                    </button>
                    <button
                      onClick={handleDeleteCampaign}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md flex items-center justify-center"
                      title="Delete Campaign"
                    >
                      <DeleteIcon style={{ fontSize: '20px' }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Category, Location, Group */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    {post.category}
                  </span>
                  {post.locationCity || post.locationCountry ? (
                    <span className="inline-block pill text-xs px-3 py-1 rounded-full text-themed-secondary">
                      {post.locationCity}{post.locationCity && post.locationCountry ? ', ' : ''}{post.locationCountry}
                    </span>
                  ) : null}
                  {post.groupId && (
                    <Link to={`/group/${post.groupId}`} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                      Posted in: <span className="font-medium">{groupName || 'Group'}</span>
                    </Link>
                  )}
                  {Array.isArray(post.tags) && post.tags.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-themed-muted">
                      {post.tags.slice(0, 5).map((t, i) => (
                        <span key={i} className="pill px-2 py-0.5 rounded-full">#{t}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-themed mb-4">
                {post.title}
              </h1>

              {/* Short Summary */}
              {post.shortSummary && (
                <p className="text-themed-secondary mb-4">{post.shortSummary}</p>
              )}

              {/* Image */}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className="w-full h-96 object-cover rounded-xl mb-6"
                />
              )}

              {/* Description */}
              <div className="prose max-w-none">
                <p className="text-themed-secondary whitespace-pre-wrap leading-relaxed">
                  {post.description}
                </p>
              </div>

              {/* Video (YouTube) */}
              {typeof post.videoUrl === 'string' && /youtube\.com|youtu\.be/.test(post.videoUrl) && (
                <div className="mt-6">
                  <div className="aspect-video w-full rounded-xl overflow-hidden">
                    <iframe
                      className="w-full h-full"
                      src={(() => {
                        const raw = post.videoUrl;
                        if (typeof raw !== 'string' || raw.trim() === '') return '';
                        try {
                          const url = new URL(raw, window.location.origin);
                          const host = (url.hostname || '').toLowerCase();
                          if (host.includes('youtu.be')) {
                            const id = (url.pathname || '/').replace('/', '');
                            return id ? `https://www.youtube.com/embed/${id}` : '';
                          }
                          const id = url.searchParams.get('v');
                          return id ? `https://www.youtube.com/embed/${id}` : raw;
                        } catch {
                          return '';
                        }
                      })()}
                      title="Campaign video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Interaction Buttons */}
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent hover:bg-transparent focus:bg-transparent transition-all ${
                      isLiked
                        ? 'text-red-600'
                        : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
                    }`}
                  >
                    {isLiked ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                    <span className="text-sm font-medium">{likesCount}</span>
                  </button>
                  
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 text-themed-secondary px-4 py-2 rounded-lg bg-transparent hover:bg-transparent focus:bg-transparent transition-colors hover:text-green-600 dark:hover:text-green-400"
                  >
                    <ShareIcon fontSize="small" />
                    <span className="text-sm font-medium">{sharesCount}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Community Posts Section */}
            <div className="mt-6">
              <CampaignUpdates 
                campaignId={id} 
                isOwner={isOwner} 
              />
            </div>
          </div>

          {/* Sidebar - Donation Section */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-20">
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-3xl font-bold text-primary">
                    {formatCurrency(post.currentAmount || 0)}
                  </span>
                </div>
                <p className="text-themed-secondary mb-3">
                  raised of {formatCurrency(post.goalAmount)} goal
                </p>
                <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                      (post.currentAmount || 0) >= (post.goalAmount || Infinity) ? 'bg-blue-600' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(calculateProgress(post.currentAmount || 0, post.goalAmount), 100)}%` }}
                  />
                </div>
                <p className="text-sm text-themed-secondary mt-2">
                  {Math.round(calculateProgress(post.currentAmount || 0, post.goalAmount))}% funded { (post.currentAmount||0) >= (post.goalAmount||Infinity) && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">Completed</span> }
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 mb-6 pb-6 border-b border-outline-variant">
                <FavoriteIcon fontSize="small" className="text-error" />
                <span className="text-themed-secondary">
                  <strong>{post.supporters || 0}</strong> supporters
                </span>
                {daysLeft() !== null && (
                  <span className="ml-auto text-sm text-themed-muted">
                    {daysLeft() < 0 ? 'Ended' : `${daysLeft()} days left`}
                  </span>
                )}
              </div>

              {/* Donation Form */}
              {currentUser && currentUser.uid !== post.authorId && (
                <div>
                  <h3 className="text-lg font-bold text-themed mb-4">
                    Support this campaign
                  </h3>

                  {error && (
                    <div className="bg-error-50 border border-error text-error-700 px-3 py-2 rounded-lg text-sm mb-4">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-500 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
                      {success}
                    </div>
                  )}

                  {(() => {
                    const goal = Number(post.goalAmount || 0);
                    const current = Number(post.currentAmount || 0);
                    const margin = Math.max(1, Math.min(goal * 0.05, 50));
                    const maxTotal = goal + margin;
                    const maxDonation = Math.max(0, +(maxTotal - current).toFixed(2));
                    const fullyFunded = maxDonation <= 0;
                    return (
                  <form onSubmit={handleDonate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-themed mb-2">
                        Donation Amount (USD)
                      </label>
                      <input
                        type="number"
                        value={donationAmount}
                        onChange={(e) => setDonationAmount(e.target.value)}
                        className="input-field"
                        placeholder="Enter amount"
                        min="1"
                        step="0.01"
                        max={maxDonation > 0 ? maxDonation : undefined}
                        required
                      />
                      <p className="text-xs text-themed-muted mt-1">
                        Wallet Balance: {formatCurrency(userProfile?.walletBalance || 0)}
                      </p>
                      <p className="text-xs text-themed-muted mt-1">
                        Max you can donate now: {formatCurrency(maxDonation)} (goal {formatCurrency(goal)} + margin {formatCurrency(margin)})
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-themed mb-2">
                        Message (Optional)
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="input-field min-h-[80px]"
                        placeholder="Leave a message of support"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={donating || fullyFunded}
                      className="btn-primary w-full"
                    >
                      {fullyFunded ? 'Goal Reached' : (donating ? 'Processing...' : 'Donate Now')}
                    </button>
                  </form>
                  );})()}
                </div>
              )}

              {currentUser && currentUser.uid === post.authorId && (
                <div className="bg-primary-50 p-4 rounded-lg text-center">
                  <p className="text-primary font-medium">
                    This is your campaign
                  </p>
                </div>
              )}

              {!currentUser && (
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full"
                >
                  Log in to Donate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CampaignDetail;
