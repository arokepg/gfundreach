import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Clock, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversations } from '../../utils/messaging';
import Layout from '../../components/Layout';

const Messages = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all'); // 'all' or 'unread'

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    let unsubscribe;
    setLoading(true);
    
    // subscribeToConversations is async, need to handle it properly
    const setupSubscription = async () => {
      unsubscribe = await subscribeToConversations(currentUser.uid, (convs) => {
        setConversations(convs);
        setLoading(false);
      });
    };
    
    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, navigate]);

  const getOtherParticipant = (conversation) => {
    // Check if it's a group
    if (conversation.type === 'group') {
      return {
        id: null,
        name: conversation.groupName || 'Group Chat',
        photo: '',
        isGroup: true,
        participantCount: conversation.participants?.length || 0
      };
    }
    
    // 1-1 conversation
    const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
    return {
      id: otherUserId,
      name: conversation.participantNames?.[otherUserId] || 'Unknown User',
      photo: conversation.participantPhotos?.[otherUserId] || '',
      isGroup: false
    };
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  // No external user search; the search box filters existing conversations only.

  const filteredConversations = conversations.filter(conv => {
    const other = getOtherParticipant(conv);
    const lastMsg = (conv.lastMessage || '').toLowerCase();
    const matchesSearch = (other.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           lastMsg.includes(searchQuery.toLowerCase());
    
    // Apply unread filter if in 'unread' mode
    // Unread tab shows: (1) messages others sent that you haven't read
    if (conversationFilter === 'unread') {
      const unreadForUser = (conv.unreadCount?.[currentUser.uid] || 0) > 0;
      return matchesSearch && unreadForUser;
    }
    
    return matchesSearch;
  });
  
  // Count unread conversations (including strangers)
  const unreadConversationsCount = conversations.filter(conv => {
    const unreadForUser = (conv.unreadCount?.[currentUser.uid] || 0) > 0;
    return unreadForUser;
  }).length;

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-themed-secondary rounded w-1/3"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-themed-secondary rounded"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-themed flex items-center gap-2">
            <MessageCircle size={28} />
            Messages
          </h1>
        </div>

        {/* Main Tabs: All Chats vs Unread */}
        <div className="flex gap-2 bg-themed-secondary p-1 rounded-xl">
          <button
            onClick={() => setConversationFilter('all')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              conversationFilter === 'all'
                ? 'bg-white dark:bg-gray-700 text-themed shadow-sm border-2 border-green-600'
                : 'text-themed-muted hover:text-themed hover:border-2 hover:border-green-600 hover:bg-white dark:hover:bg-gray-700'
            }`}
          >
            All Chats
          </button>
          <button
            onClick={() => setConversationFilter('unread')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              conversationFilter === 'unread'
                ? 'bg-white dark:bg-gray-700 text-themed shadow-sm border-2 border-green-600'
                : 'text-themed-muted hover:text-themed hover:border-2 hover:border-green-600 hover:bg-white dark:hover:bg-gray-700'
            }`}
          >
            Unread
            {unreadConversationsCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadConversationsCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar (filters existing conversations only) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" size={20} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-themed-secondary border border-themed-border text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>


        {/* Conversations List */}
        <>
          {filteredConversations.length === 0 ? (
              <div className="text-center py-16">
                <MessageCircle size={64} className="mx-auto text-themed-muted mb-4" />
                <h3 className="text-xl font-semibold text-themed mb-2">
                  {searchQuery ? 'No conversations found' : 'No messages yet'}
                </h3>
                <p className="text-themed-muted">
                  {searchQuery 
                    ? 'Try searching for something else'
                    : 'Start a conversation by visiting a campaign and clicking "Message Creator"'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conversation) => {
              const other = getOtherParticipant(conversation);
              const unreadCount = conversation.unreadCount?.[currentUser.uid] || 0;
              const hasUnread = unreadCount > 0;
              const isStranger = conversation.isStranger || false;
              const strangerFirst = isStranger && hasUnread; // only mark as New when unread and from stranger
              const showHighlight = hasUnread; // highlight only when unread

              return (
                <button
                  key={conversation.id}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  className={`w-full p-4 rounded-xl transition-all text-left hover:bg-themed-tertiary relative ${
                    showHighlight ? 'bg-green-50 dark:bg-green-900/10 border-2 border-green-600' : 'bg-themed-secondary border border-themed-border'
                  }`}
                >
                  {/* Unread Dot Indicator */}
                  {hasUnread && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="shrink-0 relative">
                      {other.photo && !other.isGroup ? (
                        <img
                          src={other.photo}
                          alt={other.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                          {other.isGroup ? <Users size={24} /> : other.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Online/Unread status badge */}
                      {hasUnread && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`${showHighlight ? 'font-bold text-themed' : 'font-semibold text-themed'}`}>
                            {other.name}
                          </h3>
                          {other.isGroup && (
                            <span className="text-xs text-themed-muted">
                              ({other.participantCount} members)
                            </span>
                          )}
                          {/* Stranger Badge */}
                          {strangerFirst && !other.isGroup && (
                            <span className="px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs flex items-center gap-1 ${showHighlight ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-themed-muted'}`}>
                            <Clock size={12} />
                            {formatTimestamp(conversation.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${showHighlight ? 'font-semibold text-themed' : 'text-themed-muted'}`}>
                          {conversation.lastMessage || 'No messages yet'}
                        </p>
                        {hasUnread && (
                          <span className="shrink-0 px-2.5 py-1 text-xs font-bold text-white bg-red-500 rounded-full min-w-[24px] text-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
              </div>
            )}
          </>
      </div>
    </Layout>
  );
};

export default Messages;
