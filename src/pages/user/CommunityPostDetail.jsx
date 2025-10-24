import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CampaignIcon from '@mui/icons-material/Campaign';

const CommunityPostDetail = () => {
  const { campaignId, postId } = useParams();
  const [post, setPost] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPostAndCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, postId]);

  const fetchPostAndCampaign = async () => {
    try {
      setLoading(true);
      
      // Fetch the community post
      const postDoc = await getDoc(doc(db, 'posts', campaignId, 'updates', postId));
      
      if (!postDoc.exists()) {
        setError('Post not found');
        return;
      }

      const postData = { id: postDoc.id, ...postDoc.data() };
      setPost(postData);

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
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              {post.authorPhoto ? (
                <img
                  src={post.authorPhoto}
                  alt={post.authorName}
                  className="w-12 h-12 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <PersonIcon className="text-gray-600 dark:text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-themed text-lg">{post.authorName || 'Anonymous'}</h3>
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

          {/* Post Metadata */}
          <div className="pt-6 border-t border-outline-variant">
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
