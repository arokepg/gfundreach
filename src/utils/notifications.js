import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, increment, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Create a notification in Firestore
 * @param {string} recipientId - User ID who will receive the notification
 * @param {string} type - Type of notification: 'like', 'share', 'donation', 'donation_receipt', 'comment', 'community_post', 'follow'
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
 * Group/batch like notifications per recipient + postId within a time window
 * Falls back to a single doc with an aggregate counter and up to 3 recent names
 */
export const createOrGroupLikeNotification = async (recipientId, data) => {
  try {
    if (data.senderId === recipientId) return;
    const { postId, senderName } = data;
    if (!postId) return createNotification(recipientId, 'like', data);

    // Find an existing grouped like notification for this post
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', recipientId),
      where('type', '==', 'like_grouped'),
      where('postId', '==', postId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const ref = doc(db, 'notifications', d.id);
      const existing = d.data();
      const names = Array.isArray(existing.names) ? existing.names : [];
      const newNames = [senderName, ...names.filter(n => n && n !== senderName)].slice(0, 3);
      await updateDoc(ref, {
        likesCount: increment(1),
        names: newNames,
        // Optionally bump timestamp so it surfaces to top
        createdAt: serverTimestamp(),
      });
      return;
    }
    // Create new grouped like
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      type: 'like_grouped',
      read: false,
      createdAt: serverTimestamp(),
      postId,
      postTitle: data.postTitle || '',
      likesCount: 1,
      names: [senderName].filter(Boolean),
    });
  } catch (e) {
    console.warn('Failed to group like notification, sending single like instead:', e);
    await createNotification(recipientId, 'like', data);
  }
};

/**
 * Format notification message based on type
 * @param {object} notification - Notification object from Firestore
 * @returns {string} Formatted message
 */
export const formatNotificationMessage = (notification) => {
  const { type, senderName, postTitle, amount, groupName, likesCount, names } = notification;

  switch (type) {
    case 'donation':
      return `${senderName} donated $${amount} to your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'donation_receipt':
      return `Thank you for donating$${amount ? ` $${amount}` : ''}${postTitle ? ` to "${postTitle}"` : ''}`;
    case 'like':
      return `${senderName} liked your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'like_grouped': {
      const namesText = Array.isArray(names) && names.length > 0 ? `${names.join(', ')}${likesCount > names.length ? ` and ${likesCount - names.length} others` : ''}` : `${likesCount} people`;
      return `Your post${postTitle ? ` "${postTitle}"` : ''} received ${likesCount} likes from ${namesText}`;
    }
    case 'share':
      return `${senderName} shared your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'comment':
      return `${senderName} commented on your post${postTitle ? ` "${postTitle}"` : ''}`;
    case 'community_post':
      return `${senderName} posted a new community update${postTitle ? ` on "${postTitle}"` : ''}`;
    // Group-related
    case 'group_campaign_created':
      return `New campaign created in ${groupName}`;
    case 'group_post_created':
      return `New post created in ${groupName}`;
    case 'group_join_success':
      return `You joined ${groupName}`;
    case 'group_leave_success':
      return `You left ${groupName}`;
    case 'group_kicked':
      return `You were removed from ${groupName}`;
    case 'group_member_joined':
      return `${senderName} joined ${groupName}`;
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
