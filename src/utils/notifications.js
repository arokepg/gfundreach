import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Create a notification in Firestore
 * @param {string} recipientId - User ID who will receive the notification
 * @param {string} type - Type of notification: 'like', 'donation', 'comment', 'follow'
 * @param {object} data - Additional data for the notification
 * @returns {Promise<void>}
 */
export const createNotification = async (recipientId, type, data) => {
  try {
    // Don't create notification if recipient is the same as sender
    if (data.senderId === recipientId) {
      return;
    }

    const notificationData = {
      recipientId,
      type,
      read: false,
      createdAt: serverTimestamp(),
      ...data
    };

    await addDoc(collection(db, 'notifications'), notificationData);
  } catch (error) {
    console.warn('Failed to create notification:', error);
  }
};

/**
 * Format notification message based on type
 * @param {object} notification - Notification object from Firestore
 * @returns {string} Formatted message
 */
export const formatNotificationMessage = (notification) => {
  const { type, senderName, postTitle, amount } = notification;

  switch (type) {
    case 'donation':
      return `${senderName} donated $${amount} to your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'like':
      return `${senderName} liked your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'comment':
      return `${senderName} commented on your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'follow':
      return `${senderName} started following you`;
    default:
      return 'New notification';
  }
};

/**
 * Get time ago string from timestamp
 * @param {any} timestamp - Firestore timestamp
 * @returns {string} Time ago string
 */
export const getTimeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  
  const now = new Date();
  const notifDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffInMs = now - notifDate;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffInDays < 7) return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  return notifDate.toLocaleDateString();
};
