import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateConversation } from '../utils/messaging';

/**
 * Button to start a conversation with a campaign creator
 * @param {string} creatorId - User ID of the campaign creator
 * @param {string} creatorName - Display name of the creator
 * @param {string} creatorPhoto - Profile photo URL of the creator (optional)
 */
const MessageButton = ({ creatorId, creatorName, creatorPhoto = '' }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleMessageClick = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Validate creator id
    if (!creatorId) {
      alert('Creator not found. Please try again later.');
      return;
    }

    // Prevent messaging yourself
    if (String(currentUser.uid) === String(creatorId)) {
      return;
    }

    setLoading(true);
    try {
      const conversationId = await getOrCreateConversation(
        String(currentUser.uid),
        String(creatorId),
        currentUser.displayName || 'Anonymous',
        creatorName || 'User',
        currentUser.photoURL || '',
        creatorPhoto || ''
      );
      
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      // Surface more details to help diagnose rules or data issues
      console.error('Error creating conversation:', error);
      const code = error?.code ? ` (${error.code})` : '';
      const msg = error?.message ? `\nDetails: ${error.message}` : '';
      alert(`Failed to start conversation.${code}${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if user is the creator
  if (String(currentUser?.uid || '') === String(creatorId || '')) {
    return null;
  }

  return (
    <button
      onClick={handleMessageClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-themed-secondary hover:bg-themed-tertiary transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-themed-border"
      aria-label={`Send message to ${creatorName}`}
    >
      <MessageCircle size={20} className="text-themed" />
      <span className="font-medium text-themed">
        {loading ? 'Starting...' : 'Message Creator'}
      </span>
    </button>
  );
};

export default MessageButton;
