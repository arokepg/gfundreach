import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Clock, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversations, getOrCreateConversation } from '../../utils/messaging';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Layout from '../../components/Layout';

const Messages = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('conversations'); // 'conversations' or 'users'
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToConversations(currentUser.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [currentUser, navigate]);

  const getOtherParticipant = (conversation) => {
    const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
    return {
      id: otherUserId,
      name: conversation.participantNames?.[otherUserId] || 'Unknown User',
      photo: conversation.participantPhotos?.[otherUserId] || ''
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

  // Search for users in Firestore
  const searchUsers = useCallback(async (searchText) => {
    if (!searchText.trim()) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('displayName', '>=', searchText),
        where('displayName', '<=', searchText + '\\uf8ff'),
        orderBy('displayName'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const users = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.id !== currentUser.uid); // Exclude current user
      
      setUserSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [currentUser]);

  // Handle search query changes
  useEffect(() => {
    if (searchMode === 'users') {
      const timeoutId = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300); // Debounce search
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, searchMode, searchUsers]);

  const handleStartConversation = async (user) => {
    try {
      const conversationId = await getOrCreateConversation(
        currentUser.uid,
        user.id,
        currentUser.displayName || 'Anonymous',
        user.displayName || 'Unknown User',
        currentUser.photoURL || '',
        user.photoURL || ''
      );
      
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const other = getOtherParticipant(conv);
    return other.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

        {/* Toggle Search Mode */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSearchMode('conversations');
              setSearchQuery('');
              setUserSearchResults([]);
            }}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
              searchMode === 'conversations'
                ? 'bg-green-600 text-white'
                : 'bg-themed-secondary text-themed hover:bg-themed-tertiary'
            }`}
          >
            My Conversations
          </button>
          <button
            onClick={() => {
              setSearchMode('users');
              setSearchQuery('');
            }}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all ${
              searchMode === 'users'
                ? 'bg-green-600 text-white'
                : 'bg-themed-secondary text-themed hover:bg-themed-tertiary'
            }`}
          >
            <UserPlus size={18} className="inline mr-2" />
            New Message
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" size={20} />
          <input
            type="text"
            placeholder={searchMode === 'conversations' ? 'Search conversations...' : 'Search users by name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-themed-secondary border border-themed-border text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* User Search Results */}
        {searchMode === 'users' && (
          <div className="space-y-2">
            {searchingUsers && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-themed-muted mt-2">Searching users...</p>
              </div>
            )}
            
            {!searchingUsers && searchQuery && userSearchResults.length === 0 && (
              <div className="text-center py-8">
                <UserPlus size={48} className="mx-auto text-themed-muted mb-2" />
                <p className="text-themed-muted">No users found</p>
              </div>
            )}
            
            {!searchingUsers && !searchQuery && (
              <div className="text-center py-8">
                <UserPlus size={48} className="mx-auto text-themed-muted mb-2" />
                <p className="text-themed-muted">Search for users to start a conversation</p>
              </div>
            )}

            {!searchingUsers && userSearchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleStartConversation(user)}
                className="w-full p-4 rounded-xl bg-themed-secondary border border-themed-border hover:bg-themed-tertiary transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                      {(user.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-themed">{user.displayName || 'Unknown User'}</h3>
                    {user.email && (
                      <p className="text-sm text-themed-muted">{user.email}</p>
                    )}
                  </div>
                  <MessageCircle size={20} className="text-green-600" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conversations List */}
        {searchMode === 'conversations' && (
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

              return (
                <button
                  key={conversation.id}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  className={`w-full p-4 rounded-xl transition-all text-left hover:bg-themed-tertiary ${
                    hasUnread ? 'bg-themed-secondary border-2 border-green-600' : 'bg-themed-secondary border border-themed-border'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {other.photo ? (
                        <img
                          src={other.photo}
                          alt={other.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                          {other.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold ${hasUnread ? 'text-themed' : 'text-themed'}`}>
                          {other.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-themed-muted flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimestamp(conversation.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${hasUnread ? 'font-medium text-themed' : 'text-themed-muted'}`}>
                          {conversation.lastMessage || 'No messages yet'}
                        </p>
                        {hasUnread && (
                          <span className="shrink-0 px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full">
                            {unreadCount}
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
        )}
      </div>
    </Layout>
  );
};

export default Messages;
