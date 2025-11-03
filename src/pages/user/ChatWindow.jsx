import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Mic, StopCircle, Image as ImageIcon, Smile, ChevronUp, Users, Trash2, LogOut, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  subscribeToMessages, 
  sendMessage, 
  markConversationAsRead,
  getConversation,
  sendImageMessage,
  addReaction,
  removeReaction,
  loadMoreMessages
} from '../../utils/messaging';
import { leaveGroup, deleteConversation } from '../../utils/messaging';
import { createNotification } from '../../utils/notifications';
import Layout from '../../components/Layout';
import CampaignContextCard from '../../components/CampaignContextCard';
import GroupInfoPanel from '../../components/GroupInfoPanelClean';
import ChatInfoPanel from '../../components/ChatInfoPanel';
import ImageViewer from '../../components/ImageViewer';
import { useTheme } from '../../contexts/ThemeContext';

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
  const [deleting, setDeleting] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const { isDarkMode } = useTheme();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputRef = useRef(null); // For text input focus
  const lastMessageCountRef = useRef(0); // Track message count for smart scroll
  // Mentions state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionedUids, setMentionedUids] = useState([]);
  const [imagePreview, setImagePreview] = useState({ open: false, src: '', alt: '' });

  // Helpers to render mentions (@Name) in bold
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const renderTextWithMentions = (text) => {
    if (!text || typeof text !== 'string') return text;
    const names = Object.values(conversation?.participantNames || {});
    if (!names.length) return text;
    const pattern = new RegExp(`(@(?:${names.map(n => escapeRegExp(n)).sort((a,b)=>b.length-a.length).join('|')}))`, 'gi');
    const parts = text.split(pattern);
    return parts.map((part, idx) => {
      if (pattern.test(part)) {
        return <strong key={`m-${idx}`} className="font-semibold">{part}</strong>;
      }
      return <span key={`t-${idx}`}>{part}</span>;
    });
  };

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

  // Handle leave group
  const handleLeaveGroup = async () => {
    if (conversation?.type !== 'group') return;
    if (!confirm('Leave this group? You will no longer receive messages from it.')) return;
    try {
      await leaveGroup(conversationId, currentUser.uid);
      navigate('/messages');
    } catch (error) {
      alert(error.message || 'Failed to leave group');
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
      // Ensure participant names/photos are populated (for early members or missing docs)
      try {
        const participants = conv.participants || [];
        const missing = participants.filter(uid => {
          const name = conv.participantNames?.[uid];
          const photo = conv.participantPhotos?.[uid];
          return !name || name === 'User' || name === uid || !photo;
        });
        if (missing.length > 0) {
          const { db } = await import('../../config/firebase');
          const { doc, getDoc, updateDoc } = await import('firebase/firestore');
          const updates = {};
          await Promise.all(missing.map(async (uid) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const data = userDoc.data();
                const displayName = data.displayName || data.email || uid;
                const photoURL = data.photoURL || '';
                updates[`participantNames.${uid}`] = displayName;
                if (photoURL !== undefined) {
                  updates[`participantPhotos.${uid}`] = photoURL;
                }
              }
            } catch (e) {
              console.warn('Failed to backfill user profile for conversation participant', uid, e);
            }
          }));
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'conversations', conversationId), updates);
            // Reflect locally as well
            const next = { ...conv };
            next.participantNames = { ...(conv.participantNames || {}) };
            next.participantPhotos = { ...(conv.participantPhotos || {}) };
            Object.entries(updates).forEach(([k, v]) => {
              if (k.startsWith('participantNames.')) {
                const uid = k.split('.')[1];
                next.participantNames[uid] = v;
              } else if (k.startsWith('participantPhotos.')) {
                const uid = k.split('.')[1];
                next.participantPhotos[uid] = v;
              }
            });
            setConversation(next);
            return;
          }
        }
      } catch (e) {
        console.warn('Backfill participant profiles skipped due to error', e);
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
  }, [messages.length, showEmojiPicker]); // Only on count change, not all updates

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Check if it's a group conversation
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
      inputRef.current?.focus();
      // Send mention notifications (unique uids, exclude self)
      const uniqueMentions = Array.from(new Set(mentionedUids)).filter(uid => uid && uid !== currentUser.uid);
      if (uniqueMentions.length > 0) {
        const convName = conversation?.settings?.name || conversation?.groupName || 'Chat';
        const preview = messageContent.slice(0, 140);
        await Promise.all(uniqueMentions.map(uid => createNotification(uid, 'chat_mention', {
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Someone',
          conversationId,
          groupName: convName,
          messagePreview: preview
        })));
      }
      // Reset mentions after send
      setMentionedUids([]);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
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
    if (e) e.stopPropagation(); // Prevent event bubbling
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const currentReactions = message.reactions || {};
    const hasReacted = currentReactions[emoji]?.includes(currentUser.uid);
    
    console.log('Reaction clicked:', { messageId, emoji, hasReacted, currentReactions });
    
    // Close picker immediately for better UX
    setShowEmojiPicker(null);
    
    try {
      if (hasReacted) {
        console.log('Removing reaction...');
        await removeReaction(conversationId, messageId, currentUser.uid, emoji);
      } else {
        console.log('Adding reaction...');
        await addReaction(conversationId, messageId, currentUser.uid, emoji);
      }
      console.log('Reaction updated successfully');
    } catch (err) {
      console.error('Failed to toggle reaction', err);
      alert('Failed to update reaction. Please try again.');
    }
  };

  const toggleEmojiPicker = (messageId, e) => {
    if (e) e.stopPropagation();
    setShowEmojiPicker(prev => prev === messageId ? null : messageId);
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
        name: conversation.groupName || 'Group Chat',
        photo: '',
        isGroup: true,
        participantCount: conversation.participants?.length || 0
      };
    }
    
    // 1-1 conversation
    const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
    return {
      name: conversation.participantNames?.[otherUserId] || 'Unknown User',
      photo: conversation.participantPhotos?.[otherUserId] || '',
      isGroup: false,
      id: otherUserId
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
                } else if (other.id) {
                  navigate(`/profile/${other.id}`);
                }
              }}
              className={`flex items-center gap-3 rounded-lg px-2 py-1 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-themed-tertiary'}`}
              title={other.isGroup ? 'View group info' : `View ${other.name}'s profile`}
            >
              {other.isGroup ? (
                // Group avatar - always show group icon or group image
                other.photo ? (
                  <img
                    src={other.photo}
                    alt={other.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                    <Users size={20} />
                  </div>
                )
              ) : (
                // 1-1 chat - show user avatar
                other.photo ? (
                  <img
                    src={other.photo}
                    alt={other.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-gray-800">
                    {other.name.charAt(0).toUpperCase()}
                  </div>
                )
              )}
              
              <div className="text-left">
                {/* Ensure long names don't overflow header area */}
                <h2 className={`font-semibold truncate max-w-[40vw] sm:max-w-[50%] ${isDarkMode ? 'text-gray-100' : 'text-themed'}`}>{other.name}</h2>
                <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-themed-muted'}`}>
                  {other.isGroup ? `${other.participantCount} members` : 'Online'}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Shared media & Links panel (direct chat) */}
            <button
              onClick={() => setShowChatInfo(true)}
              className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              title="Shared media & links"
              aria-label="Shared media and links"
            >
              <LinkIcon size={20} className="text-blue-600 dark:text-blue-400" />
            </button>
            {/* Leave Group (only for group chats) */}
            {conversation?.type === 'group' && (
              <button
                onClick={handleLeaveGroup}
                className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20"
                title="Leave group"
                aria-label="Leave group"
              >
                <LogOut size={20} className="text-orange-600 dark:text-orange-400" />
              </button>
            )}

            {/* Delete Conversation Button */}
            {(
              // Show delete if not a group OR current user is group admin/creator
              conversation?.type !== 'group' ||
              (conversation?.type === 'group' && (conversation?.roles?.[currentUser.uid] === 'admin' || conversation?.createdBy === currentUser.uid))
            ) && (
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
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Load More Button */}
          {hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center mb-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-themed-secondary hover:bg-themed-tertiary border border-themed-border rounded-lg text-sm font-medium text-themed flex items-center gap-2 transition-all disabled:opacity-50"
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
            <div className="text-center py-8 text-themed-muted">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isCurrentUser = message.senderId === currentUser.uid;
              const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
              const reactions = message.reactions || {};
              const hasReactions = Object.keys(reactions).length > 0;
              
              // Get sender info for group chats
              const senderName = conversation?.participantNames?.[message.senderId] || message.senderName || 'User';
              const senderPhoto = conversation?.participantPhotos?.[message.senderId] || '';

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar space */}
                  <div className="w-8 shrink-0">
                    {!isCurrentUser && showAvatar && (
                      <button
                        onClick={() => {
                          if (conversation?.type === 'group' && message.senderId) {
                            navigate(`/profile/${message.senderId}`);
                          }
                        }}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        title={conversation?.type === 'group' ? `View ${senderName}'s profile` : ''}
                      >
                        {senderPhoto ? (
                          <img
                            src={senderPhoto}
                            alt={senderName}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col emoji-picker-wrapper`}>
                    {/* Sender name for group chats */}
                    {!isCurrentUser && conversation?.type === 'group' && showAvatar && (
                      /* Constrain sender name to bubble width and ellipsize */
                      <span className="text-xs text-gray-600 dark:text-gray-400 ml-2 mb-1 font-medium block w-full truncate">
                        {senderName}
                      </span>
                    )}
                    
                    {(() => {
                      const isAttachment = message.type === 'image' || message.type === 'audio' || message.type === 'campaign';
                      const bubbleBase = `relative group rounded-2xl ${isAttachment ? 'p-0 bg-transparent' : 'px-4 py-2'}`;
                      const bubbleTone = isAttachment
                        ? ''
                        : (isCurrentUser
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-themed border border-emerald-200 dark:border-emerald-800 rounded-br-sm'
                            : 'bg-white dark:bg-gray-800 text-themed border border-themed-border rounded-bl-sm');
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
                                className="max-w-full rounded-xl border border-gray-300 dark:border-gray-700 cursor-zoom-in"
                                onClick={() => setImagePreview({ open: true, src: message.imageUrl, alt: 'Shared image' })}
                                onError={(e) => { e.target.src = ''; e.target.alt = '[Image failed to load]'; }}
                              />
                              {message.caption && (
                                <p className="mt-2 px-2 text-sm text-themed">{message.caption}</p>
                              )}
                            </div>
                          ) : message.type === 'campaign' && message.campaign ? (
                            <CampaignContextCard campaign={message.campaign} compact={false} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{renderTextWithMentions(message.content)}</p>
                          )}
                          {/* Emoji picker button (appears on hover) */}
                          <button
                            onClick={(e) => toggleEmojiPicker(message.id, e)}
                            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-themed-secondary border border-themed-border rounded-full p-1 transition-opacity hover:scale-110"
                            title="React"
                            type="button"
                          >
                            <Smile size={14} className="text-themed" />
                          </button>
                        </div>
                      );
                    })()}
                    
                    {/* Show reactions */}
                    {hasReactions && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(reactions).map(([emoji, userIds]) => {
                          const count = userIds.length;
                          const userReacted = userIds.includes(currentUser.uid);
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => handleReaction(message.id, emoji, e)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                                userReacted 
                                  ? 'bg-green-100 dark:bg-green-900/30 border-green-500' 
                                  : 'bg-themed-secondary border-themed-border hover:border-green-500'
                              }`}
                              type="button"
                            >
                              {emoji} {count > 1 && count}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Emoji picker popup */}
                    {showEmojiPicker === message.id && (
                      <div className="mt-1 flex gap-1 p-2 bg-themed-secondary border border-themed-border rounded-lg shadow-lg z-10">
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={(e) => handleReaction(message.id, emoji, e)}
                            className="text-xl hover:scale-125 transition-transform p-1"
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    
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
              className="px-3 rounded-xl font-medium transition-colors flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              title="Send image"
              disabled={sending || sendingVoice || sendingImage}
            >
              <ImageIcon size={20} />
            </button>
            
            {/* Voice record button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-3 rounded-xl font-medium transition-colors flex items-center justify-center ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'}`}
              title={isRecording ? 'Stop recording' : 'Record voice message'}
              disabled={sending || sendingVoice || sendingImage}
            >
              {isRecording ? <StopCircle size={22} /> : <Mic size={20} />}
            </button>
            
            {/* Text input with anchored mention suggestions */}
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => {
                const value = e.target.value;
                setNewMessage(value);
                // Detect mentions: last token starting with '@' or '@('
                const caretPos = e.target.selectionStart || value.length;
                const uptoCaret = value.slice(0, caretPos);
                const atIndex = Math.max(uptoCaret.lastIndexOf('@('), uptoCaret.lastIndexOf('@'));
                if (atIndex >= 0) {
                  const token = uptoCaret.slice(atIndex);
                  // Stop token at first whitespace or closing parenthesis
                  const match = token.match(/^@\(?([^\s)]{0,40})$/);
                  if (match) {
                    const q = match[1].toLowerCase();
                    // Build candidates from participants
                    const parts = Object.entries(conversation?.participantNames || {})
                      .filter(([uid]) => uid !== currentUser.uid)
                      .map(([uid, name]) => ({ uid, name, photo: conversation?.participantPhotos?.[uid] || '' }));
                    const filtered = parts.filter(p => !q || p.name.toLowerCase().includes(q));
                    setMentionCandidates(filtered.slice(0, 8));
                    setMentionIndex(0);
                    setMentionOpen(filtered.length > 0);
                    return;
                  }
                }
                setMentionOpen(false);
              }}
                placeholder="Type a message..."
                className={`w-full px-4 py-3 rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent ${isDarkMode ? 'bg-gray-800 text-gray-100 border border-gray-700 focus:ring-green-500' : 'bg-white text-gray-900 border border-gray-200 focus:ring-green-600'}`}
                disabled={sending || sendingImage}
                onKeyDown={(e) => {
                if (!mentionOpen) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionCandidates.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
                else if (e.key === 'Tab' || e.key === 'Enter') {
                  const choice = mentionCandidates[mentionIndex];
                  if (choice) {
                    e.preventDefault();
                    // Replace the current @ token with @Name
                    const el = e.currentTarget;
                    const caret = el.selectionStart || newMessage.length;
                    const upto = newMessage.slice(0, caret);
                    const from = Math.max(upto.lastIndexOf('@('), upto.lastIndexOf('@'));
                    const before = newMessage.slice(0, from);
                    const after = newMessage.slice(caret);
                    const insert = `@${choice.name} `;
                    const next = before + insert + after;
                    setNewMessage(next);
                    setMentionOpen(false);
                    
                    setMentionCandidates([]);
                    setMentionIndex(0);
                    setTimeout(() => {
                      try { el.setSelectionRange((before + insert).length, (before + insert).length); } catch (_E) { void _E; /* ignore */ }
                    }, 0);
                    setMentionedUids(prev => prev.includes(choice.uid) ? prev : [...prev, choice.uid]);
                  }
                } else if (e.key === 'Escape') {
                  setMentionOpen(false);
                }
                }}
              />
              {/* Mention suggestions dropdown anchored to input width */}
              {mentionOpen && mentionCandidates.length > 0 && (
                <div className={`absolute bottom-full mb-2 left-0 right-0 z-20`}>
                  <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto`}>
                    {mentionCandidates.map((p, idx) => (
                      <button
                        key={p.uid}
                        type="button"
                        onClick={() => {
                          const el = inputRef.current;
                          if (!el) return;
                          const caret = el.selectionStart || newMessage.length;
                          const upto = newMessage.slice(0, caret);
                          const from = Math.max(upto.lastIndexOf('@('), upto.lastIndexOf('@'));
                          const before = newMessage.slice(0, from);
                          const after = newMessage.slice(caret);
                          const insert = `@${p.name} `;
                          const next = before + insert + after;
                          setNewMessage(next);
                          setMentionOpen(false);
                          setMentionCandidates([]);
                          setMentionIndex(0);
                          setTimeout(() => {
                            try { el.focus(); el.setSelectionRange((before + insert).length, (before + insert).length); } catch (_E) { void _E; /* ignore */ }
                          }, 0);
                          setMentionedUids(prev => prev.includes(p.uid) ? prev : [...prev, p.uid]);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left ${idx === mentionIndex ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') : ''}`}
                      >
                        {p.photo ? (
                          <img src={p.photo} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-linear-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`${isDarkMode ? 'text-gray-100' : 'text-gray-800'} text-sm truncate`}>@{p.name}</span>
                      </button>
                    ))}
                  </div>
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
            <div className="mt-2 text-xs text-themed-muted flex items-center gap-2">
              {isRecording ? 'Recording… tap stop to send' : sendingVoice ? 'Sending voice message…' : 'Uploading image…'}
            </div>
          )}
        </form>
        {/* Mention suggestions moved to be anchored to the input field above */}
      </div>
      {conversation?.type === 'group' && (
        <GroupInfoPanel conversationId={conversationId} open={showGroupInfo} onClose={() => setShowGroupInfo(false)} />
      )}
      <ChatInfoPanel conversationId={conversationId} open={showChatInfo} onClose={() => setShowChatInfo(false)} />
      <ImageViewer
        open={imagePreview.open}
        src={imagePreview.src}
        alt={imagePreview.alt}
        onClose={() => setImagePreview({ open: false, src: '', alt: '' })}
      />
    </Layout>
  );
};

export default ChatWindow;
