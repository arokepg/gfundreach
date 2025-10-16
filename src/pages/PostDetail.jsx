import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import LinearProgress from '@mui/material/LinearProgress';
import PersonIcon from '@mui/icons-material/Person';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
  }, [id]);

  const fetchPost = async () => {
    try {
      const postDoc = await getDoc(doc(db, 'posts', id));
      if (postDoc.exists()) {
        setPost({ id: postDoc.id, ...postDoc.data() });
      } else {
        setError('Post not found');
      }
    } catch (err) {
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

  if (error && !post) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="card p-8 text-center">
            <p className="text-error text-lg">{error}</p>
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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  {post.authorPhoto ? (
                    <img
                      src={post.authorPhoto}
                      alt={post.authorName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <PersonIcon className="text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{post.authorName}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Category */}
              <div className="mb-4">
                <span className="inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {post.category}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
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
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
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
                <p className="text-gray-600 mb-3">
                  raised of {formatCurrency(post.goalAmount)} goal
                </p>
                <LinearProgress
                  variant="determinate"
                  value={calculateProgress(post.currentAmount || 0, post.goalAmount)}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#E7E0EC',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#6750A4',
                    },
                  }}
                />
                <p className="text-sm text-gray-600 mt-2">
                  {Math.round(calculateProgress(post.currentAmount || 0, post.goalAmount))}% funded
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 mb-6 pb-6 border-b border-outline-variant">
                <FavoriteIcon fontSize="small" className="text-error" />
                <span className="text-gray-700">
                  <strong>{post.supporters || 0}</strong> supporters
                </span>
              </div>

              {/* Donation Form */}
              {currentUser && currentUser.uid !== post.authorId && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <p className="text-xs text-gray-500 mt-1">
                        Wallet Balance: {formatCurrency(userProfile?.walletBalance || 0)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
