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
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

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
 */
export const getOrCreateConversation = async (currentUserId, otherUserId, currentUserName, otherUserName, currentUserPhoto = '', otherUserPhoto = '') => {
  const uidA = String(currentUserId || '').trim();
  const uidB = String(otherUserId || '').trim();
  if (!uidA || !uidB || uidA === uidB) throw new Error('Invalid participants');

  const convId = getConversationId(uidA, uidB);
  const convRef = doc(db, 'conversations', convId);

  // First try to touch an existing conversation without requiring a read
  try {
    await updateDoc(convRef, {
      lastMessageAt: serverTimestamp(),
      // Keep caller's latest profile data up to date
      [`participantNames.${uidA}`]: String(currentUserName || 'User'),
      [`participantPhotos.${uidA}`]: String(currentUserPhoto || ''),
    });
    return convId;
  } catch (err) {
    // If not-found, create; otherwise rethrow
    if (err && (err.code === 'not-found' || err.message?.includes('No document to update'))) {
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
        unreadCount: {
          [uidA]: 0,
          [uidB]: 0,
        },
        createdAt: serverTimestamp(),
      });
      return convId;
    }
    throw err;
  }
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
 * Subscribe to messages in a conversation (real-time)
 * Returns unsubscribe function
 */
export const subscribeToMessages = (conversationId, callback) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamp to Date
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));
    callback(messages);
  }, (error) => {
    console.error('Error subscribing to messages:', error);
    callback([]);
  });
};

/**
 * Subscribe to conversations list for a user (real-time)
 * Returns unsubscribe function
 */
export const subscribeToConversations = (userId, callback) => {
  const convRef = collection(db, 'conversations');
  const q = query(
    convRef,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert timestamps
      lastMessageAt: doc.data().lastMessageAt?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }));
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
