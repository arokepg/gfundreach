import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Mic, StopCircle, Image as ImageIcon, Smile, TrendingUp, ChevronUp, Users, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  subscribeToMessages, 
  sendMessage, 
  markConversationAsRead,
  getConversation,
  sendImageMessage,
  addReaction,
  removeReaction,
  loadMoreMessages,
  deleteConversation
} from '../../utils/messaging';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import CampaignContextCard from '../../components/CampaignContextCard';
import GroupInfoPanel from '../../components/GroupInfoPanel';
import MediaViewer from '../../components/MediaViewer';
import PersonalChatInfoPanel from '../../components/PersonalChatInfoPanel';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ChatWindow = () => {
  const { conversationId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // messageId for picker
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [lastDocRef, setLastDocRef] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTagging, setShowTagging] = useState(false);
  const [taggingQuery, setTaggingQuery] = useState('');
  const [tagCursorPosition, setTagCursorPosition] = useState(0);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [mediaList, setMediaList] = useState([]);
  const { isDarkMode } = useTheme();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const taggingDropdownRef = useRef(null);

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteConversation(conversationId);
      navigate('/messages');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
      setDeleting(false);
    }
  };

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
    const currentCount = messages.length;
    const previousCount = lastMessageCountRef.current;
    
    // Only scroll if there's actually a NEW message (count increased)
    // and emoji picker is not open
    if (currentCount > previousCount && !showEmojiPicker) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Update the ref for next comparison
    lastMessageCountRef.current = currentCount;
  }, [messages.length, showEmojiPicker]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewMessage(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      if (!textAfterAt.includes(' ') && conversation?.type === 'group') {
        setShowTagging(true);
        setTaggingQuery(textAfterAt.toLowerCase());
        setTagCursorPosition(lastAtIndex);
      } else {
        setShowTagging(false);
      }
    } else {
      setShowTagging(false);
    }
  };

  const handleSelectTag = (user) => {
    const beforeTag = newMessage.substring(0, tagCursorPosition);
    const afterTag = newMessage.substring(tagCursorPosition).replace(/@[^\s]*/, '');
    const newValue = `${beforeTag}@${user.displayName} ${afterTag}`;
    
    setNewMessage(newValue);
    setShowTagging(false);
    setTaggingQuery('');
    
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeTag.length + user.displayName.length + 2;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const getTaggableUsers = () => {
    if (!conversation || conversation.type !== 'group') return [];
    
    return (conversation.participants || [])
      .filter(participantId => participantId !== currentUser.uid)
      .map(participantId => ({
        id: participantId,
        displayName: conversation.participantNames?.[participantId] || 'Unknown',
        photoURL: conversation.participantPhotos?.[participantId] || ''
      }))
      .filter(user => 
        user.displayName.toLowerCase().includes(taggingQuery)
      )
      .slice(0, 5);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setSending(true);
    setNewMessage('');
    setShowTagging(false);

    try {
      const isGroup = conversation?.type === 'group';
      
      if (isGroup) {
        const { sendGroupMessage } = await import('../../utils/messaging');
        await sendGroupMessage(
          conversationId,
          currentUser.uid,
          currentUser.displayName || 'Anonymous',
          messageContent
        );
      } else {
        await sendMessage(
          conversationId,
          currentUser.uid,
          currentUser.displayName || 'Anonymous',
          messageContent
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageContent);
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  // Voice recording helpers
  const toDataURL = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const startRecording = async () => {
    if (isRecording || sendingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        try {
          const durationMs = Date.now() - recordStartRef.current;
          const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
          // Size guard: Firestore doc 1MB limit; base64 increases ~33%, so limit blob < ~700KB
          if (blob.size > 700 * 1024) {
            alert('Voice message is too large. Please keep it under ~30 seconds.');
            return;
          }
          setSendingVoice(true);
          const dataUrl = await toDataURL(blob);
          const { sendVoiceMessage } = await import('../../utils/messaging');
          await sendVoiceMessage(
            conversationId,
            currentUser.uid,
            currentUser.displayName || 'Anonymous',
            dataUrl,
            durationMs
          );
        } catch (err) {
          console.error('Failed to send voice message', err);
          alert('Failed to send voice message. Please try again.');
          } finally {
            setSendingVoice(false);
            // Stop all tracks
            try {
              rec.stream.getTracks().forEach((t) => t.stop());
            } catch {
              /* ignore */
            }
          }
      };
      mediaRecorderRef.current = rec;
      recordStartRef.current = Date.now();
      rec.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic permission/recording failed', err);
      alert('Cannot access microphone. Please allow mic permission.');
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } finally {
      setIsRecording(false);
    }
  };

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Size check (< 500KB recommended)
    if (file.size > 500 * 1024) {
      alert('Image is too large. Please select an image smaller than 500KB.');
      return;
    }
    
    setSendingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await sendImageMessage(
            conversationId,
            currentUser.uid,
            currentUser.displayName || 'Anonymous',
            reader.result,
            '' // optional caption
          );
        } catch (err) {
          console.error('Failed to send image', err);
          alert('Failed to send image. ' + (err.message || ''));
        } finally {
          setSendingImage(false);
          if (imageInputRef.current) imageInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        alert('Failed to read image file');
        setSendingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image upload error', err);
      alert('Failed to process image');
      setSendingImage(false);
    }
  };

  // Reaction handlers
  const handleReaction = async (messageId, emoji, e) => {
    if (e) e.stopPropagation();
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const currentReactions = message.reactions || {};
    const hasReacted = currentReactions[emoji]?.includes(currentUser.uid);
    
    setShowEmojiPicker(null);
    
    try {
      if (hasReacted) {
        await removeReaction(conversationId, messageId, currentUser.uid, emoji);
      } else {
        await addReaction(conversationId, messageId, currentUser.uid, emoji);
      }
    } catch (err) {
      console.error('Failed to toggle reaction', err);
      alert('Failed to update reaction. Please try again.');
    }
  };

  const toggleEmojiPicker = (messageId, e) => {
    if (e) e.stopPropagation();
    setShowEmojiPicker(prev => prev === messageId ? null : messageId);
  };

  const handleMediaClick = (mediaUrl) => {
    const allMedia = messages
      .filter(msg => msg.type === 'image' || msg.type === 'video')
      .map(msg => ({
        id: msg.id,
        url: msg.imageUrl || msg.videoUrl,
        type: msg.type,
        senderName: conversation.participantNames?.[msg.senderId] || 'Unknown'
      }));
    
    const clickedIndex = allMedia.findIndex(m => m.url === mediaUrl);
    setMediaList(allMedia);
    setCurrentMediaIndex(clickedIndex >= 0 ? clickedIndex : 0);
    setShowMediaViewer(true);
  };

  const handleMediaNavigate = (newIndex) => {
    setCurrentMediaIndex(newIndex);
  };

  const handleCloseMediaViewer = () => {
    setShowMediaViewer(false);
    setMediaList([]);
    setCurrentMediaIndex(0);
  };
  
  // Load more older messages (lazy loading)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    try {
      const result = await loadMoreMessages(conversationId, lastDocRef, 50);
      
      // Prepend older messages to the beginning
      setMessages(prev => [...result.messages, ...prev]);
      setLastDocRef(result.lastDoc);
      setHasMoreMessages(result.hasMore);
      
      // Maintain scroll position after loading more
      // (user should stay where they were, not jump)
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showEmojiPicker && !e.target.closest('.emoji-picker-wrapper')) {
        setShowEmojiPicker(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showEmojiPicker]);

  const getOtherParticipant = () => {
    if (!conversation) return { name: 'User', photo: '', isGroup: false };
    
    // Check if it's a group conversation
    if (conversation.type === 'group') {
      return {
        name: conversation.settings?.name || conversation.groupName || 'Group Chat',
        photo: conversation.settings?.groupImageUrl || '',
        isGroup: true,
        participantCount: conversation.participants?.length || 0
      };
    }
    
    // 1-1 conversation
    const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
    return {
      name: conversation.participantNames?.[otherUserId] || 'Unknown User',
      photo: conversation.participantPhotos?.[otherUserId] || '',
      isGroup: false
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
      <div className="w-full md:max-w-4xl mx-auto h-[calc(100vh-120px)] md:h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
  <div className={`shrink-0 p-4 flex items-center justify-between gap-4 border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/messages')}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-themed-tertiary'}`}
              aria-label="Back to messages"
            >
              <ArrowLeft size={24} className={`${isDarkMode ? 'text-gray-100' : 'text-themed'}`} />
            </button>
            
            <button
              type="button"
              onClick={() => {
                if (other.isGroup) {
                  setShowGroupInfo(true);
                } else {
                  setShowPersonalInfo(true);
                }
              }}
              className={`flex items-center gap-3 rounded-lg px-2 py-1 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-themed-tertiary'}`}
              title={other.isGroup ? 'View group info' : `View chat info`}
            >
              {other.photo ? (
                <img
                  src={other.photo}
                  alt={other.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                  {other.isGroup ? <Users size={20} /> : other.name.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="text-left">
                <h2 className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-themed'}`}>{other.name}</h2>
                <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-themed-muted'}`}>
                  {other.isGroup ? `${other.participantCount} members` : 'Online'}
                </p>
              </div>
            </button>
          </div>

          {/* Delete Conversation Button */}
          <button
            onClick={handleDeleteConversation}
            disabled={deleting}
            className={`p-2 rounded-lg transition-colors ${
              deleting 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
            title="Delete conversation"
            aria-label="Delete conversation"
          >
            {deleting ? (
              <Loader2 size={20} className="animate-spin text-red-600 dark:text-red-400" />
            ) : (
              <Trash2 size={20} className="text-red-600 dark:text-red-400" />
            )}
          </button>
        </div>

  {/* Messages Area */}
  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-themed">
          {/* Load More Button */}
          {hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center mb-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 border ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700 hover:bg-gray-700' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'}`}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronUp size={16} />
                    Load older messages
                  </>
                )}
              </button>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.senderId === currentUser.uid;
              const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
              const reactions = message.reactions || {};
              const hasReactions = Object.keys(reactions).length > 0;

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar space */}
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      (() => {
                        // Get sender's photo and name
                        const senderPhoto = conversation.participantPhotos?.[message.senderId] || '';
                        const senderName = conversation.participantNames?.[message.senderId] || 'User';
                        
                        return senderPhoto ? (
                          <img
                            src={senderPhoto}
                            alt={senderName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col relative`}>
                    {(() => {
                      const isAttachment = message.type === 'image' || message.type === 'audio' || message.type === 'campaign';
                      const bubbleBase = `relative group rounded-2xl ${isAttachment ? 'p-0 bg-transparent' : 'px-4 py-2'} animate-chat-bubble`;
                      const bubbleTone = isAttachment
                        ? ''
                        : (isCurrentUser
                            ? 'bg-white text-gray-800 border border-emerald-300 dark:bg-emerald-900/20 dark:text-gray-100 dark:border-emerald-800 rounded-br-sm'
                            : 'bg-white text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 rounded-bl-sm');
                      return (
                        <div className={`${bubbleBase} ${bubbleTone}`}>
                          {/* Render different message types */}
                          {message.type === 'audio' && message.audioUrl ? (
                            <audio controls src={message.audioUrl} className="max-w-full">
                              Your browser does not support the audio element.
                            </audio>
                          ) : message.type === 'image' && message.imageUrl ? (
                            <div>
                              <img 
                                src={message.imageUrl} 
                                alt="Shared" 
                                className="max-w-full rounded-xl border border-gray-300 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleMediaClick(message.imageUrl)}
                                onError={(e) => { e.target.src = ''; e.target.alt = '[Image failed to load]'; }}
                              />
                              {message.caption && (
                                <p className="mt-2 px-2 text-sm text-gray-800 dark:text-gray-100">{message.caption}</p>
                              )}
                            </div>
                          ) : message.type === 'campaign' && message.campaign ? (
                            <CampaignContextCard campaign={message.campaign} compact={false} />
                          ) : (
                            <p className="whitespace-pre-wrap wrap-break-word text-gray-800 dark:text-gray-100">{message.content}</p>
                          )}
                          {/* Emoji picker button (appears on hover) */}
                          <button
                            onClick={(e) => toggleEmojiPicker(message.id, e)}
                            className={`absolute -bottom-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full p-1 transition-opacity hover:scale-110 ${
                              isCurrentUser ? '-right-2' : '-left-2'
                            }`}
                            title="React"
                            type="button"
                          >
                            <Smile size={14} className="text-gray-700 dark:text-gray-300" />
                          </button>
                        </div>
                      );
                    })()}
                    
                    {/* Show reactions */}
                    {hasReactions && (
                      <div className={`flex gap-1 mt-1 flex-wrap ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(reactions).map(([emoji, userIds]) => {
                          const count = userIds.length;
                          const userReacted = userIds.includes(currentUser.uid);
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => handleReaction(message.id, emoji, e)}
                              className={`text-xs px-2 py-1 rounded-full border transition-all hover:scale-105 ${
                                userReacted 
                                  ? isDarkMode
                                    ? 'bg-green-900/40 border-green-500 text-green-300'
                                    : 'bg-green-100 border-green-500 text-green-800'
                                  : isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-gray-300 hover:border-green-500'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-green-500'
                              }`}
                              type="button"
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>{emoji}</span>
                                {count > 1 && <span className="text-xs font-semibold">{count}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Emoji picker popup */}
                    {showEmojiPicker === message.id && (
                      <div className={`absolute bottom-0 flex gap-1 p-2 rounded-lg shadow-lg z-10 animate-fadeIn ${
                        isDarkMode 
                          ? 'bg-gray-800 border border-gray-700' 
                          : 'bg-white border border-gray-300'
                      } ${isCurrentUser ? 'right-0' : 'left-0'}`}>
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={(e) => handleReaction(message.id, emoji, e)}
                            className={`text-xl hover:scale-125 transition-transform p-1 rounded ${
                              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            type="button"
                            title={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
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
  {/* Force light/dark styles explicitly */}
  <form onSubmit={handleSendMessage} className={`shrink-0 p-4 border-t ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex gap-2">
            {/* Image upload button */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className={`px-3 rounded-xl font-medium transition-colors flex items-center justify-center ${isDarkMode ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              title="Send image"
              disabled={sending || sendingVoice || sendingImage}
            >
              <ImageIcon size={20} />
            </button>
            
            {/* Voice record button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-3 rounded-xl font-medium transition-colors flex items-center justify-center ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : (isDarkMode ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30' : 'bg-green-50 text-green-700 hover:bg-green-100')}`}
              title={isRecording ? 'Stop recording' : 'Record voice message'}
              disabled={sending || sendingVoice || sendingImage}
            >
              {isRecording ? <StopCircle size={22} /> : <Mic size={20} />}
            </button>
            
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className={`w-full px-4 py-3 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent ${isDarkMode ? 'bg-gray-800 text-gray-100 border border-gray-700 focus:ring-green-500' : 'bg-white text-gray-900 border border-gray-200 focus:ring-green-600'}`}
                disabled={sending || sendingImage}
              />
              
              {showTagging && getTaggableUsers().length > 0 && (
                <div
                  ref={taggingDropdownRef}
                  className={`absolute bottom-full mb-2 left-0 right-0 rounded-lg shadow-lg border max-h-48 overflow-y-auto z-50 ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`px-3 py-2 text-xs font-semibold border-b ${
                    isDarkMode 
                      ? 'text-gray-400 border-gray-700' 
                      : 'text-gray-600 border-gray-200'
                  }`}>
                    Tag someone
                  </div>
                  <ul>
                    {getTaggableUsers().map(user => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectTag(user)}
                          className={`w-full px-3 py-2 flex items-center gap-3 transition-colors ${
                            isDarkMode 
                              ? 'hover:bg-gray-700 text-gray-100' 
                              : 'hover:bg-gray-50 text-gray-900'
                          }`}
                        >
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{user.displayName}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || sendingImage}
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
          {(isRecording || sendingVoice || sendingImage) && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
              {isRecording ? 'Recording… tap stop to send' : sendingVoice ? 'Sending voice message…' : 'Uploading image…'}
            </div>
          )}
        </form>
      </div>
      {conversation?.type === 'group' && (
        <GroupInfoPanel conversationId={conversationId} open={showGroupInfo} onClose={() => setShowGroupInfo(false)} />
      )}
      
      {conversation?.type !== 'group' && (
        <PersonalChatInfoPanel 
          conversationId={conversationId} 
          otherUser={other} 
          open={showPersonalInfo} 
          onClose={() => setShowPersonalInfo(false)} 
        />
      )}
      
      {showMediaViewer && (
        <MediaViewer
          media={mediaList}
          currentIndex={currentMediaIndex}
          onClose={handleCloseMediaViewer}
          onNavigate={handleMediaNavigate}
        />
      )}
    </Layout>
  );
};

export default ChatWindow;
