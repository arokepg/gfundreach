import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search, Clock, Users, UserPlus, X, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversations, getOrCreateConversation, createGroupConversation } from '../../utils/messaging';
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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

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
        name: conversation.settings?.name || conversation.groupName || 'Group Chat',
        photo: conversation.settings?.groupImageUrl || '',
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

  // Search users for group creation
  useEffect(() => {
    const searchUsersForGroup = async () => {
      if (!groupSearchQuery.trim() || groupSearchQuery.length < 2) {
        setGroupSearchResults([]);
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        const searchLower = groupSearchQuery.trim().toLowerCase();
        
        // Fetch a reasonable number of users and filter client-side
        // This is more reliable than case-sensitive Firestore queries
        const q = query(usersRef, limit(100));
        const snapshot = await getDocs(q);
        
        const users = [];
        snapshot.forEach(doc => {
          const userData = doc.data();
          const displayName = userData.displayName || '';
          const email = userData.email || '';
          
          // Exclude current user and already selected users
          if (doc.id !== currentUser.uid && !selectedUsers.find(u => u.id === doc.id)) {
            // Case-insensitive search in displayName or email
            if (
              displayName.toLowerCase().includes(searchLower) ||
              email.toLowerCase().includes(searchLower)
            ) {
              users.push({
                id: doc.id,
                displayName: displayName || 'Unknown User',
                photoURL: userData.photoURL || '',
                email: email
              });
            }
          }
        });
        
        // Limit to 10 results
        setGroupSearchResults(users.slice(0, 10));
      } catch (error) {
        console.error('Error searching users for group:', error);
        setGroupSearchResults([]);
      }
    };

    const debounce = setTimeout(searchUsersForGroup, 300);
    return () => clearTimeout(debounce);
  }, [groupSearchQuery, currentUser.uid, selectedUsers]);

  const handleAddUserToGroup = (user) => {
    setSelectedUsers(prev => [...prev, user]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
  };

  const handleRemoveUserFromGroup = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedUsers.length < 1) {
      alert('Please add at least one member to the group');
      return;
    }

    setCreatingGroup(true);
    try {
      const participantIds = selectedUsers.map(u => u.id);
      const participantData = selectedUsers.map(u => ({
        id: u.id,
        name: u.displayName,
        photo: u.photoURL
      }));

      const conversationId = await createGroupConversation(
        currentUser.uid,
        currentUser.displayName || 'You',
        participantIds,
        participantData,
        groupName.trim(),
        null, // groupContext
        '', // groupImageUrl
        currentUser.photoURL || '' // creatorPhoto
      );

      // Reset form
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedUsers([]);
      setGroupSearchQuery('');

      // Navigate to the new group chat
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group. Please try again.');
    } finally {
      setCreatingGroup(false);
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
      <div className="w-full md:max-w-4xl mx-auto p-2 md:p-4 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-in-up">
          <h1 className="text-2xl font-bold text-themed flex items-center gap-2">
            <MessageCircle size={28} />
            Messages
          </h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95"
          >
            <Users size={18} />
            <span className="hidden sm:inline">Create Group</span>
          </button>
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
                      {other.isGroup ? (
                        // Group chat: show uploaded group avatar or default icon
                        conversation.settings?.groupImageUrl ? (
                          <img
                            src={conversation.settings.groupImageUrl}
                            alt={other.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                            <Users size={24} />
                          </div>
                        )
                      ) : other.photo ? (
                        <img
                          src={other.photo}
                          alt={other.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                          {other.name.charAt(0).toUpperCase()}
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

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creatingGroup && setShowCreateGroup(false)} />
          <div className={`relative w-full max-w-md max-h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-slideUp overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <h3 className={`text-xl font-semibold flex items-center gap-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                <Users size={22} />
                Create Group Chat
              </h3>
              <button
                onClick={() => !creatingGroup && setShowCreateGroup(false)}
                disabled={creatingGroup}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
              {/* Group Name */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  disabled={creatingGroup}
                  className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Selected Members ({selectedUsers.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-100'
                            : 'bg-gray-50 border-gray-300 text-gray-900'
                        }`}
                      >
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium">{user.displayName}</span>
                        <button
                          onClick={() => handleRemoveUserFromGroup(user.id)}
                          disabled={creatingGroup}
                          className="ml-1 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Users */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Add Members
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} size={18} />
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    placeholder="Search people by name..."
                    disabled={creatingGroup}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>

                {/* Search Results */}
                {groupSearchResults.length > 0 && (
                  <div className={`mt-2 max-h-60 overflow-y-auto scrollbar-hide space-y-2 border rounded-lg p-2 ${
                    isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'
                  }`}>
                    {groupSearchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleAddUserToGroup(user)}
                        disabled={creatingGroup}
                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 text-left">
                            <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                              {user.displayName}
                            </div>
                            <div className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                        <Check size={18} className="text-green-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`p-6 border-t flex gap-3 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <button
                onClick={() => setShowCreateGroup(false)}
                disabled={creatingGroup}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isDarkMode
                    ? 'bg-gray-800 text-gray-100 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupName.trim() || selectedUsers.length < 1}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingGroup ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  'Create Group'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Messages;
