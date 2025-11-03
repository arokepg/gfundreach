import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Mic, StopCircle, Image as ImageIcon, Smile, TrendingUp, ChevronUp, Users } from 'lucide-react';
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
import Layout from '../../components/Layout';
import CampaignContextCard from '../../components/CampaignContextCard';
import GroupInfoPanel from '../../components/GroupInfoPanel';

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
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const inputRef = useRef(null); // For text input focus
  const lastMessageCountRef = useRef(0); // Track message count for smart scroll

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
          
          <button
            type="button"
            onClick={() => other.isGroup && setShowGroupInfo(true)}
            className="flex items-center gap-3 hover:bg-themed-tertiary rounded-lg px-2 py-1"
            title={other.isGroup ? 'View group info' : other.name}
          >
            {other.photo && !other.isGroup ? (
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
              <h2 className="font-semibold text-themed">{other.name}</h2>
              <p className="text-xs text-themed-muted">
                {other.isGroup ? `${other.participantCount} members` : 'Online'}
              </p>
            </div>
          </button>
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
                  <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col emoji-picker-wrapper`}>
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
                                className="max-w-full rounded-xl border border-themed-border"
                                onError={(e) => { e.target.src = ''; e.target.alt = '[Image failed to load]'; }}
                              />
                              {message.caption && (
                                <p className="mt-2 px-2 text-sm text-themed">{message.caption}</p>
                              )}
                            </div>
                          ) : message.type === 'campaign' && message.campaign ? (
                            <CampaignContextCard campaign={message.campaign} compact={false} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-themed">{message.content}</p>
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
            
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-xl bg-themed border border-themed-border text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600"
              disabled={sending || sendingImage}
            />
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
      </div>
      {conversation?.type === 'group' && (
        <GroupInfoPanel conversationId={conversationId} open={showGroupInfo} onClose={() => setShowGroupInfo(false)} />
      )}
    </Layout>
  );
};

export default ChatWindow;
