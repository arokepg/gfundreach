import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  subscribeToMessages, 
  sendMessage, 
  markConversationAsRead,
  getConversation 
} from '../../utils/messaging';
import Layout from '../../components/Layout';

const ChatWindow = () => {
  const { conversationId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation details
  useEffect(() => {
    if (!currentUser || !conversationId) {
      navigate('/login');
      return;
    }

    const loadConversation = async () => {
      const conv = await getConversation(conversationId);
      if (!conv) {
        navigate('/messages');
        return;
      }
      setConversation(conv);
    };

    loadConversation();
  }, [conversationId, currentUser, navigate]);

  // Subscribe to messages
  useEffect(() => {
    if (!currentUser || !conversationId) return;

    setLoading(true);
    const unsubscribe = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });

    // Mark as read when opening conversation
    markConversationAsRead(conversationId, currentUser.uid);

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await sendMessage(
        conversationId,
        currentUser.uid,
        currentUser.displayName || 'Anonymous',
        messageContent
      );
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = () => {
    if (!conversation) return { name: 'User', photo: '' };
    const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
    return {
      name: conversation.participantNames?.[otherUserId] || 'Unknown User',
      photo: conversation.participantPhotos?.[otherUserId] || ''
    };
  };

  const formatMessageTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const other = getOtherParticipant();

  if (loading || !conversation) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] flex items-center justify-center">
          <Loader2 className="animate-spin text-themed" size={48} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-4 bg-themed-secondary border-b border-themed-border flex items-center gap-4">
          <button
            onClick={() => navigate('/messages')}
            className="p-2 rounded-lg hover:bg-themed-tertiary transition-colors"
            aria-label="Back to messages"
          >
            <ArrowLeft size={24} className="text-themed" />
          </button>
          
          {other.photo ? (
            <img
              src={other.photo}
              alt={other.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
              {other.name.charAt(0).toUpperCase()}
            </div>
          )}
          
          <div>
            <h2 className="font-semibold text-themed">{other.name}</h2>
            <p className="text-xs text-themed-muted">Online</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-themed-muted">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.senderId === currentUser.uid;
              const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar space */}
                  <div className="w-8 shrink-0">
                    {!isCurrentUser && showAvatar && (
                      other.photo ? (
                        <img
                          src={other.photo}
                          alt={other.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                          {other.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isCurrentUser
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-themed-secondary text-themed rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                    </div>
                    <span className="text-xs text-themed-muted mt-1 px-2">
                      {formatMessageTime(message.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="shrink-0 p-4 bg-themed-secondary border-t border-themed-border">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-xl bg-themed border border-themed-border text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ChatWindow;
