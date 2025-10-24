import { useState, useEffect } from 'react';
import { updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { saveItem, unsaveItem, isItemSaved } from './savedItems';

/**
 * Shared hook for card interactions (like, share, save)
 * @param {Object} params
 * @param {Object} params.item - The item (campaign/post/update)
 * @param {Object} params.currentUser - Current authenticated user
 * @param {Object} params.docRef - Firestore document reference for the item
 * @param {string} params.itemType - Type: 'post' or 'update'
 * @returns {Object} State and handlers
 */
export const useCardInteractions = ({ item, currentUser, docRef, itemType = 'post' }) => {
  const [isLiked, setIsLiked] = useState(item.likedBy?.includes(currentUser?.uid) || false);
  const [likesCount, setLikesCount] = useState(item.likesCount || 0);
  const [sharesCount, setSharesCount] = useState(item.sharesCount || 0);
  const [isSaved, setIsSaved] = useState(false);

  // Check saved status
  useEffect(() => {
    const checkSaved = async () => {
      if (currentUser && item.id) {
        const saved = await isItemSaved(currentUser.uid, item.id);
        setIsSaved(saved);
      }
    };
    checkSaved();
  }, [currentUser, item.id]);

  const handleLike = async (e) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to like');
      return;
    }
    try {
      if (isLiked) {
        await updateDoc(docRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1),
        });
        setIsLiked(false);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        await updateDoc(docRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1),
        });
        setIsLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async (e, { url, title, text }) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(docRef, { sharesCount: increment(1) });
      setSharesCount((c) => c + 1);
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleSave = async (e, saveData) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      alert('Please log in to save');
      return;
    }
    try {
      if (isSaved) {
        await unsaveItem(currentUser.uid, item.id);
        setIsSaved(false);
      } else {
        await saveItem(currentUser.uid, item.id, itemType, saveData);
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  return {
    isLiked,
    likesCount,
    sharesCount,
    isSaved,
    handleLike,
    handleShare,
    handleSave,
  };
};

/**
 * Format timestamp to relative time
 */
export const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
  const now = new Date();
  const diffMs = now - date;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};
