import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const PostDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPost = async () => {
    try {
      console.log('Fetching post with id:', id);
      const postDoc = await getDoc(doc(db, 'posts', id));
      console.log('Post exists:', postDoc.exists());
      if (postDoc.exists()) {
        const postData = { id: postDoc.id, ...postDoc.data() };
        console.log('Post data:', postData);
        setPost(postData);
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

      // Create donation transaction
      await addDoc(collection(db, 'transactions'), {
        type: 'donation',
        amount,
        message,
        postId: id,
        postTitle: post.title,
        donorId: currentUser.uid,
        donorName: currentUser.displayName || 'Anonymous',
        recipientId: post.authorId,
        recipientName: post.authorName,
        createdAt: new Date().toISOString(),
      });

      // Update post current amount and supporters
      await updateDoc(doc(db, 'posts', id), {
        currentAmount: increment(amount),
        supporters: increment(1),
      });

      // Update donor wallet balance and total donated
      await updateDoc(doc(db, 'users', currentUser.uid), {
        walletBalance: increment(-amount),
        totalDonated: increment(amount),
      });

      // Update recipient total received
      await updateDoc(doc(db, 'users', post.authorId), {
        totalReceived: increment(amount),
      });

      setSuccess(`Successfully donated $${amount}! Thank you for your support.`);
      setDonationAmount('');
      setMessage('');
      
      // Refresh post data
      await fetchPost();
      
    } catch (err) {
      setError('Failed to process donation: ' + err.message);
    } finally {
      setDonating(false);
    }
  };

  const calculateProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
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

  const handleViewStats = () => {
    navigate(`/campaign-stats/${id}`);
  };

  const isOwner = currentUser && post && currentUser.uid === post.authorId;

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

                {/* Campaign Management Buttons - Only visible to owner */}
                {isOwner && (
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
                      className="p-2 bg-[#6750A4] hover:bg-[#4F378B] text-white rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 shadow-md flex items-center justify-center"
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

              {/* Category */}
              <div className="mb-4">
                <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {post.category}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-themed mb-4">
                {post.title}
              </h1>

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

              {/* Share Button */}
              <div className="mt-6 pt-6 border-t border-outline-variant">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-primary hover:bg-primary-50 px-4 py-2 rounded-lg transition-colors"
                >
                  <ShareIcon fontSize="small" />
                  Share this campaign
                </button>
              </div>
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
                    className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(calculateProgress(post.currentAmount || 0, post.goalAmount), 100)}%` }}
                  />
                </div>
                <p className="text-sm text-themed-secondary mt-2">
                  {Math.round(calculateProgress(post.currentAmount || 0, post.goalAmount))}% funded
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 mb-6 pb-6 border-b border-outline-variant">
                <FavoriteIcon fontSize="small" className="text-error" />
                <span className="text-themed-secondary">
                  <strong>{post.supporters || 0}</strong> supporters
                </span>
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
                        required
                      />
                      <p className="text-xs text-themed-muted mt-1">
                        Wallet Balance: {formatCurrency(userProfile?.walletBalance || 0)}
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
                      disabled={donating}
                      className="btn-primary w-full"
                    >
                      {donating ? 'Processing...' : 'Donate Now'}
                    </button>
                  </form>
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

export default PostDetail;
