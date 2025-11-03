import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
  limit,
  startAfter
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { listFriendIds } from './friends';

/**
 * Generate conversation ID from two user IDs
 * Always returns the same ID regardless of order
 */
export const getConversationId = (uid1, uid2) => {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

/**
 * Get or create a conversation between two users
 * Auto-sends greeting message if it's the first time messaging
 */
export const getOrCreateConversation = async (currentUserId, otherUserId, currentUserName, otherUserName, currentUserPhoto = '', otherUserPhoto = '') => {
  const uidA = String(currentUserId || '').trim();
  const uidB = String(otherUserId || '').trim();
  if (!uidA || !uidB || uidA === uidB) throw new Error('Invalid participants');

  const convId = getConversationId(uidA, uidB);
  const convRef = doc(db, 'conversations', convId);
  
  let isNewConversation = false;

  // First try to update; if it fails for any reason (not-found or permission), create instead
  try {
    await updateDoc(convRef, {
      lastMessageAt: serverTimestamp(),
      // Keep caller's latest profile data up to date
      [`participantNames.${uidA}`]: String(currentUserName || 'User'),
      [`participantPhotos.${uidA}`]: String(currentUserPhoto || ''),
    });
  } catch {
    // Fallback to creating the conversation (rules allow create when caller is a participant)
    await setDoc(convRef, {
      participants: [uidA, uidB],
      participantNames: {
        [uidA]: String(currentUserName || 'User'),
        [uidB]: String(otherUserName || 'User'),
      },
      participantPhotos: {
        [uidA]: String(currentUserPhoto || ''),
        [uidB]: String(otherUserPhoto || ''),
      },
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastSenderId: '',
      unreadCount: {
        [uidA]: 0,
        [uidB]: 0,
      },
      hasReplied: {
        [uidA]: false,
        [uidB]: false,
      },
      createdAt: serverTimestamp(),
      firstMessageSent: false, // Track if first message has been sent
    });
    isNewConversation = true;
  }
  
  // Auto-send greeting message if this is a new conversation and other user has greeting configured
  if (isNewConversation) {
    try {
      const otherUserDoc = await getDoc(doc(db, 'users', uidB));
      if (otherUserDoc.exists()) {
        const greetingMessage = otherUserDoc.data().greetingMessage;
        if (greetingMessage && greetingMessage.trim()) {
          // Replace {RecipientName} with current user's name
          const personalizedGreeting = greetingMessage.replace(/\{RecipientName\}/g, currentUserName || 'there');
          
          // Send auto-greeting from the other user
          const messagesRef = collection(convRef, 'messages');
          await addDoc(messagesRef, {
            senderId: uidB,
            senderName: otherUserName,
            content: personalizedGreeting,
            read: false,
            isAutoGreeting: true, // Mark as auto-greeting
            createdAt: serverTimestamp()
          });
          
          // Update conversation with greeting as last message
          await updateDoc(convRef, {
            lastMessage: personalizedGreeting.substring(0, 100),
            lastMessageAt: serverTimestamp(),
            firstMessageSent: true,
            lastSenderId: uidB,
            [`unreadCount.${uidA}`]: increment(1)
          });
        } else {
          // Mark as first message sent even if no greeting
          await updateDoc(convRef, { firstMessageSent: true });
        }
      } else {
        await updateDoc(convRef, { firstMessageSent: true });
      }
    } catch (err) {
      console.error('Error sending auto-greeting:', err);
      // Don't fail conversation creation if greeting fails
    }
  }
  
  return convId;
};

/**
 * Send a message in a conversation
 */
export const sendMessage = async (conversationId, senderId, senderName, content) => {
  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');
  
  // Add message to subcollection
  await addDoc(messagesRef, {
    senderId,
    senderName,
    content,
    read: false,
    createdAt: serverTimestamp()
  });
  
  // Update conversation metadata
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) return;
  
  const participants = convSnap.data().participants;
  const otherUserId = participants.find(id => id !== senderId);
  
  await updateDoc(convRef, {
    lastMessage: content.substring(0, 100),
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    [`hasReplied.${senderId}`]: true,
    [`unreadCount.${otherUserId}`]: increment(1)
  });
};

/**
 * Send a voice (audio) message.
 * Stores audio as a Data URL inside the message document to avoid configuring Storage.
 * Keep the blob small (e.g., <= ~700KB) to respect Firestore 1MB document limit.
 */
export const sendVoiceMessage = async (conversationId, senderId, senderName, audioDataUrl, durationMs = 0) => {
  if (!audioDataUrl || typeof audioDataUrl !== 'string' || !audioDataUrl.startsWith('data:audio')) {
    throw new Error('Invalid audio payload');
  }

  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');

  // Add audio message
  await addDoc(messagesRef, {
    senderId,
    senderName,
    type: 'audio',
    audioUrl: audioDataUrl,
    audioDuration: durationMs,
    content: '[Voice message]', // for previews
    read: false,
    createdAt: serverTimestamp(),
  });

  // Update conversation metadata and unread count
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) return;
  const participants = convSnap.data().participants;
  const otherUserId = participants.find(id => id !== senderId);
  await updateDoc(convRef, {
    lastMessage: '[Voice message]',
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    [`hasReplied.${senderId}`]: true,
    [`unreadCount.${otherUserId}`]: increment(1)
  });
};

/**
 * Mark conversation as read for current user
 */
export const markConversationAsRead = async (conversationId, userId) => {
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    [`unreadCount.${userId}`]: 0
  });
  
  // Mark all messages as read
  const messagesRef = collection(convRef, 'messages');
  const q = query(
    messagesRef,
    where('senderId', '!=', userId),
    where('read', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const updatePromises = snapshot.docs.map(doc => 
    updateDoc(doc.ref, { read: true })
  );
  
  await Promise.all(updatePromises);
};

/**
 * Subscribe to messages in a conversation (real-time) with lazy loading support
 * Returns unsubscribe function
 * @param {string} conversationId - The conversation ID
 * @param {Function} callback - Callback function to receive messages
 * @param {number} pageSize - Number of messages to load per page (default: 50)
 */
export const subscribeToMessages = (conversationId, callback, pageSize = 50) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(pageSize));
  
  return onSnapshot(q, (snapshot) => {
    // Reverse to show oldest first (chronological order)
    const messages = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to Date
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }))
      .reverse();
    callback(messages);
  }, (error) => {
    console.error('Error subscribing to messages:', error);
    callback([]);
  });
};

/**
 * Load more (older) messages for pagination
 * @param {string} conversationId - The conversation ID
 * @param {Object} lastDoc - The last document from previous query (for pagination)
 * @param {number} pageSize - Number of messages to load
 * @returns {Promise<{messages: Array, lastDoc: Object}>} 
 */
export const loadMoreMessages = async (conversationId, lastDoc, pageSize = 50) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  let q;
  
  if (lastDoc) {
    q = query(
      messagesRef, 
      orderBy('createdAt', 'desc'), 
      startAfter(lastDoc),
      limit(pageSize)
    );
  } else {
    q = query(
      messagesRef, 
      orderBy('createdAt', 'desc'), 
      limit(pageSize)
    );
  }
  
  const snapshot = await getDocs(q);
  const messages = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }))
    .reverse(); // Show oldest first
  
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  
  return {
    messages,
    lastDoc: newLastDoc,
    hasMore: snapshot.docs.length === pageSize
  };
};

/**
 * Subscribe to conversations list for a user (real-time)
 * Returns unsubscribe function
 */
export const subscribeToConversations = async (userId, callback) => {
  const convRef = collection(db, 'conversations');

  // Attempt indexed query (ordered). If index missing, fall back to unordered query and sort client-side
  let q;
  try {
    q = query(
      convRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );
    // Trigger index check early; if index missing this will throw and we will fallback
    await getDocs(q);
  } catch (err) {
    console.warn('Falling back to unordered conversations query (likely missing index on lastMessageAt):', err?.code || err?.message);
    q = query(
      convRef,
      where('participants', 'array-contains', userId),
      limit(50)
    );
  }

  // Get user's friend list once (best-effort)
  let friendIds = [];
  try {
    friendIds = await listFriendIds(userId);
  } catch (error) {
    console.error('Error fetching friend list:', error);
  }

  return onSnapshot(q, async (snapshot) => {
    let conversations = await Promise.all(snapshot.docs.map(async d => {
      const data = d.data() || {};
      const otherUserId = Array.isArray(data.participants)
        ? data.participants.find(id => id !== userId)
        : undefined;
      const isStranger = otherUserId && !friendIds.includes(otherUserId);

      const lastMessageAt = data.lastMessageAt?.toDate?.() || new Date(0);
      const createdAt = data.createdAt?.toDate?.() || new Date(0);

      return {
        id: d.id,
        ...data,
        isStranger,
        lastMessageAt,
        createdAt,
      };
    }));

    // If query wasn't ordered, ensure deterministic order here
    conversations.sort((a, b) => (b.lastMessageAt?.getTime?.() || 0) - (a.lastMessageAt?.getTime?.() || 0));

    callback(conversations);
  }, (error) => {
    console.error('Error subscribing to conversations:', error);
    callback([]);
  });
};

/**
 * Get a single conversation by ID
 */
export const getConversation = async (conversationId) => {
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  
  if (!convSnap.exists()) {
    return null;
  }
  
  return {
    id: convSnap.id,
    ...convSnap.data(),
    lastMessageAt: convSnap.data().lastMessageAt?.toDate() || new Date(),
    createdAt: convSnap.data().createdAt?.toDate() || new Date()
  };
};

/**
 * Get total unread message count for a user
 */
export const getTotalUnreadCount = async (userId) => {
  const convRef = collection(db, 'conversations');
  const q = query(convRef, where('participants', 'array-contains', userId));
  
  const snapshot = await getDocs(q);
  let total = 0;
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    total += data.unreadCount?.[userId] || 0;
  });
  
  return total;
};

/**
 * Send an image message with base64 data URL
 * Includes size guard to respect Firestore 1MB limit
 */
export const sendImageMessage = async (conversationId, senderId, senderName, imageDataUrl, caption = '') => {
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image')) {
    throw new Error('Invalid image payload');
  }

  // Size guard: base64 increases by ~33%; keep image docs < ~700KB
  const estimatedSize = (imageDataUrl.length * 0.75) / 1024; // KB
  if (estimatedSize > 700) {
    throw new Error('Image is too large. Please compress or use a smaller image (< 500KB recommended).');
  }

  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');

  await addDoc(messagesRef, {
    senderId,
    senderName,
    type: 'image',
    imageUrl: imageDataUrl,
    content: caption || '[Image]',
    caption,
    read: false,
    createdAt: serverTimestamp(),
  });

  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) return;
  const participants = convSnap.data().participants;
  const otherUserId = participants.find(id => id !== senderId);
  await updateDoc(convRef, {
    lastMessage: caption || '[Image]',
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUserId}`]: increment(1)
  });
};

/**
 * Send a campaign context card message
 */
export const sendCampaignCard = async (conversationId, senderId, senderName, campaignData) => {
  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');

  await addDoc(messagesRef, {
    senderId,
    senderName,
    type: 'campaign',
    campaign: {
      id: campaignData.id,
      title: campaignData.title,
      description: campaignData.description || '',
      imageUrl: campaignData.imageUrl || '',
      category: campaignData.category || '',
      currentAmount: campaignData.currentAmount || 0,
      goalAmount: campaignData.goalAmount || 0,
      supporters: campaignData.supporters || 0,
    },
    content: `Shared campaign: ${campaignData.title}`,
    read: false,
    createdAt: serverTimestamp(),
  });

  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) return;
  const participants = convSnap.data().participants;
  const otherUserId = participants.find(id => id !== senderId);
  await updateDoc(convRef, {
    lastMessage: `Shared campaign: ${campaignData.title}`,
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUserId}`]: increment(1)
  });
};

/**
 * Add a reaction (emoji) to a message
 */
export const addReaction = async (conversationId, messageId, userId, emoji) => {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);
  
  if (!messageSnap.exists()) return;
  
  const currentReactions = messageSnap.data().reactions || {};
  const reactionKey = emoji;
  
  if (!currentReactions[reactionKey]) {
    currentReactions[reactionKey] = [];
  }
  
  if (!currentReactions[reactionKey].includes(userId)) {
    currentReactions[reactionKey] = [...currentReactions[reactionKey], userId];
  }
  
  await updateDoc(messageRef, { reactions: currentReactions });
};

/**
 * Remove a reaction from a message
 */
export const removeReaction = async (conversationId, messageId, userId, emoji) => {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);
  
  if (!messageSnap.exists()) return;
  
  const currentReactions = messageSnap.data().reactions || {};
  const reactionKey = emoji;
  
  if (currentReactions[reactionKey]) {
    currentReactions[reactionKey] = currentReactions[reactionKey].filter(id => id !== userId);
    if (currentReactions[reactionKey].length === 0) {
      delete currentReactions[reactionKey];
    }
  }
  
  await updateDoc(messageRef, { reactions: currentReactions });
};

/**
 * Update typing status for a user in a conversation
 */
export const updateTypingStatus = async (conversationId, userId, isTyping) => {
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    [`typing.${userId}`]: isTyping ? serverTimestamp() : null
  });
};

/**
 * Create a group conversation (for campaign donors/helpers)
 */
export const createGroupConversation = async (creatorId, creatorName, participantIds, participantData, groupName, groupContext = null) => {
  if (!participantIds || participantIds.length < 2) {
    throw new Error('Group must have at least 2 participants');
  }

  const allParticipants = Array.from(new Set([creatorId, ...participantIds]));
  
  // Build participant names/photos maps
  const participantNames = { [creatorId]: creatorName };
  const participantPhotos = {};
  
  participantData.forEach(p => {
    participantNames[p.id] = p.name || 'User';
    participantPhotos[p.id] = p.photo || '';
  });

  const convRef = doc(collection(db, 'conversations'));
  
  await setDoc(convRef, {
    type: 'group',
    groupName: groupName || 'Group Chat', // kept for backward compatibility
    settings: {
      name: groupName || 'Group Chat',
      groupImageUrl: '',
      // invitePermission: 'auto' | 'approval' (admin review)
      invitePermission: 'approval',
    },
    participants: allParticipants,
    participantNames,
    participantPhotos,
    createdBy: creatorId,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadCount: Object.fromEntries(allParticipants.map(id => [id, 0])),
    createdAt: serverTimestamp(),
    // Optional context (e.g., campaign info for donor groups)
    context: groupContext,
    // roles map: uid -> 'admin' | 'member'
    roles: Object.fromEntries(allParticipants.map(id => [id, id === creatorId ? 'admin' : 'member'])),
    // pendingInvites: uid -> { invitedBy, invitedAt }
    pendingInvites: {},
  });

  return convRef.id;
};

/**
 * Send a message in a group conversation
 */
export const sendGroupMessage = async (conversationId, senderId, senderName, content) => {
  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');
  
  await addDoc(messagesRef, {
    senderId,
    senderName,
    content,
    read: false,
    createdAt: serverTimestamp()
  });
  
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) return;
  
  const participants = convSnap.data().participants;
  const updates = {
    lastMessage: content.substring(0, 100),
    lastMessageAt: serverTimestamp(),
  };
  
  // Increment unread for all participants except sender
  participants.forEach(uid => {
    if (uid !== senderId) {
      updates[`unreadCount.${uid}`] = increment(1);
    }
  });
  
  await updateDoc(convRef, updates);
};

/**
 * Update group settings (admin only)
 */
export const updateGroupSettings = async (conversationId, actorId, patch) => {
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const data = snap.data();
  if (data.type !== 'group') throw new Error('Not a group conversation');
  const role = data.roles?.[actorId];
  if (role !== 'admin') throw new Error('Only admins can update group settings');

  const next = {};
  if (typeof patch.name === 'string') next['settings.name'] = patch.name;
  if (typeof patch.groupImageUrl === 'string') next['settings.groupImageUrl'] = patch.groupImageUrl;
  if (patch.invitePermission === 'auto' || patch.invitePermission === 'approval') {
    next['settings.invitePermission'] = patch.invitePermission;
  }
  if (Object.keys(next).length === 0) return;
  await updateDoc(convRef, next);
};

/**
 * Invite a member to a group. If invitePermission is 'auto' or inviter is admin, join immediately; else goes to pendingInvites
 */
export const inviteMember = async (conversationId, inviterId, userId, userName = 'User', userPhoto = '') => {
  if (inviterId === userId) throw new Error('Cannot invite yourself');
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const data = snap.data();
  if (data.type !== 'group') throw new Error('Not a group conversation');
  const already = (data.participants || []).includes(userId);
  if (already) return { status: 'already-member' };

  const inviterRole = data.roles?.[inviterId] || 'member';
  const canAuto = data.settings?.invitePermission === 'auto' || inviterRole === 'admin';

  if (canAuto) {
    const updates = {
      participants: [...(data.participants || []), userId],
      [`participantNames.${userId}`]: userName,
      [`participantPhotos.${userId}`]: userPhoto,
      [`unreadCount.${userId}`]: 0,
      [`roles.${userId}`]: 'member',
    };
    await updateDoc(convRef, updates);
    return { status: 'joined' };
  } else {
    await updateDoc(convRef, {
      [`pendingInvites.${userId}`]: {
        invitedBy: inviterId,
        invitedAt: serverTimestamp(),
      }
    });
    return { status: 'pending' };
  }
};

/** Approve a pending invite (admin only) */
export const approveInvite = async (conversationId, adminId, userId, userName = 'User', userPhoto = '') => {
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const data = snap.data();
  if (data.roles?.[adminId] !== 'admin') throw new Error('Only admins can approve invites');

  if ((data.participants || []).includes(userId)) {
    // Clean pending if exists
    await updateDoc(convRef, { [`pendingInvites.${userId}`]: null });
    return { status: 'already-member' };
  }

  const updates = {
    participants: [...(data.participants || []), userId],
    [`participantNames.${userId}`]: userName,
    [`participantPhotos.${userId}`]: userPhoto,
    [`unreadCount.${userId}`]: 0,
    [`roles.${userId}`]: 'member',
    [`pendingInvites.${userId}`]: null,
  };
  await updateDoc(convRef, updates);
  return { status: 'joined' };
};

/** Reject/remove a pending invite (admin only) */
export const rejectInvite = async (conversationId, adminId, userId) => {
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const data = snap.data();
  if (data.roles?.[adminId] !== 'admin') throw new Error('Only admins can reject invites');
  await updateDoc(convRef, { [`pendingInvites.${userId}`]: null });
  return { status: 'removed' };
};

/** Set a member's role (admin only) */
export const setGroupRole = async (conversationId, adminId, targetUserId, role) => {
  if (!['admin', 'member'].includes(role)) throw new Error('Invalid role');
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) throw new Error('Conversation not found');
  const data = snap.data();
  if (data.roles?.[adminId] !== 'admin') throw new Error('Only admins can change roles');
  await updateDoc(convRef, { [`roles.${targetUserId}`]: role });
};

/**
 * Aggregate shared media/links from recent messages
 */
export const getSharedMedia = async (conversationId, max = 200) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(max));
  const snapshot = await getDocs(q);
  const images = [];
  const audios = [];
  const campaigns = [];
  const links = [];
  const urlRe = /(https?:\/\/[^\s]+)/gi;
  snapshot.docs.forEach(d => {
    const m = d.data();
    if (m.type === 'image' && m.imageUrl) images.push({ id: d.id, url: m.imageUrl, caption: m.caption || '', createdAt: m.createdAt?.toDate?.() || new Date() });
    if (m.type === 'audio' && m.audioUrl) audios.push({ id: d.id, url: m.audioUrl, duration: m.audioDuration || 0, createdAt: m.createdAt?.toDate?.() || new Date() });
    if (m.type === 'campaign' && m.campaign) campaigns.push({ id: d.id, campaign: m.campaign, createdAt: m.createdAt?.toDate?.() || new Date() });
    if ((!m.type || m.type === 'text') && typeof m.content === 'string') {
      const found = m.content.match(urlRe);
      if (found) found.forEach(u => links.push({ id: `${d.id}:${u}`, url: u, createdAt: m.createdAt?.toDate?.() || new Date() }));
    }
  });
  return { images, audios, campaigns, links };
};
