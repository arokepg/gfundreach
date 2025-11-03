import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Clock, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversations, getOrCreateConversation } from '../../utils/messaging';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';

const Messages = () => {
  const { currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all'); // 'all' or 'unread'
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  // Search for new users in Firestore
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      try {
        const usersRef = collection(db, 'users');
        const searchLower = searchQuery.toLowerCase();
        
        // Search by displayName or email
        const q = query(
          usersRef,
          where('displayName', '>=', searchLower),
          where('displayName', '<=', searchLower + '\uf8ff'),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const users = [];
        
        snapshot.forEach(doc => {
          const userData = doc.data();
          // Exclude current user from results
          if (doc.id !== currentUser.uid) {
            users.push({
              id: doc.id,
              displayName: userData.displayName || 'Unknown User',
              photoURL: userData.photoURL || '',
              email: userData.email || ''
            });
          }
        });
        
        setSearchResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUser.uid]);

  // Start a conversation with a user
  const handleStartConversation = async (userId, userName, userPhoto) => {
    try {
      const conversationId = await getOrCreateConversation(
        currentUser.uid,
        userId,
        currentUser.displayName || 'You',
        userName,
        currentUser.photoURL || '',
        userPhoto || ''
      );
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

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
      <div className="max-w-4xl mx-auto p-4 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-in-up">
          <h1 className="text-2xl font-bold text-themed flex items-center gap-2">
            <MessageCircle size={28} />
            Messages
          </h1>
        </div>

        {/* Main Tabs: All Chats vs Unread */}
  <div className={`flex gap-2 p-1 rounded-xl animate-slide-in-up ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <button
            onClick={() => setConversationFilter('all')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all border outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 ${
              conversationFilter === 'all'
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : isDarkMode
                  ? 'bg-gray-800 text-gray-100 border-gray-700 hover:border-green-500 hover:bg-gray-700'
                  : 'bg-white text-gray-800 border-gray-200 hover:text-gray-900 hover:border-green-400 hover:bg-gray-50'
            }`}
          >
            All Chats
          </button>
          <button
            onClick={() => setConversationFilter('unread')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 border outline-none focus-visible:ring-2 focus-visible:ring-green-500/50 ${
              conversationFilter === 'unread'
                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                : isDarkMode
                  ? 'bg-gray-800 text-gray-100 border-gray-700 hover:border-green-500 hover:bg-gray-700'
                  : 'bg-white text-gray-800 border-gray-200 hover:text-gray-900 hover:border-green-400 hover:bg-gray-50'
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

        {/* Search Bar */}
        <div className="relative animate-slide-in-up">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" size={20} />
          <input
            type="text"
            placeholder="Search conversations or find new people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
              isDarkMode
                ? 'bg-gray-800 text-gray-100 placeholder-gray-400 border border-gray-700 hover:border-gray-600 focus:ring-green-500'
                : 'bg-white text-gray-900 border border-gray-200 hover:border-gray-300 focus:ring-green-600'
            }`}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            </div>
          )}
        </div>

        {/* New Users Search Results */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="space-y-2 animate-slide-in-up">
            <h3 className="text-sm font-semibold text-themed-muted px-2">New People</h3>
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleStartConversation(user.id, user.displayName, user.photoURL)}
                className={`w-full p-4 rounded-xl transition-all text-left hover:shadow-md hover:-translate-y-px animate-fade-in ${
                  isDarkMode ? 'bg-gray-800 border border-gray-700 text-gray-100 hover:bg-gray-700' : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="shrink-0 relative">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-themed flex items-center gap-2">
                      {user.displayName}
                      <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center gap-1">
                        <UserPlus size={12} />
                        New
                      </span>
                    </h3>
                    <p className="text-sm text-themed-muted">{user.email}</p>
                  </div>
                  
                  <MessageCircle size={20} className="text-green-600 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conversations List */}
        <>
          {filteredConversations.length === 0 && searchResults.length === 0 ? (
              <div className="text-center py-16">
                <MessageCircle size={64} className="mx-auto text-themed-muted mb-4" />
                <h3 className="text-xl font-semibold text-themed mb-2">
                  {searchQuery ? 'No conversations found' : 'No messages yet'}
                </h3>
                <p className="text-themed-muted">
                  {searchQuery 
                    ? 'No results found. Try a different search term.'
                    : 'Start a conversation by searching for people or visiting a campaign'
                  }
                </p>
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="space-y-2 animate-slide-in-up">
                {searchQuery.trim() && <h3 className="text-sm font-semibold text-themed-muted px-2">Your Conversations</h3>}
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
                  className={`w-full p-4 rounded-xl transition-all text-left hover:shadow-md hover:-translate-y-px relative animate-fade-in ${
                    showHighlight
                      ? isDarkMode
                        ? 'bg-green-900/10 border-2 border-green-600 text-gray-100'
                        : 'bg-green-50 border-2 border-green-600'
                      : isDarkMode
                        ? 'bg-gray-800 border border-gray-700 text-gray-100'
                        : 'bg-white border border-gray-200'
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
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
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
                          <span className="shrink-0 px-2.5 py-1 text-xs font-bold text-white bg-red-500 rounded-full min-w-6 text-center">
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
            ) : null}
          </>
      </div>
    </Layout>
  );
};

export default Messages;
