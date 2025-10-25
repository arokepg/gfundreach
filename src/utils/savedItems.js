import { doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc, collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Save/bookmark an item (post or campaign)
 * @param {string} userId - Current user ID
 * @param {string} itemId - Post/campaign ID
 * @param {string} itemType - 'post' or 'campaign'
 * @param {object} itemData - Basic data about the item (title, image, etc.)
 */
export const saveItem = async (userId, itemId, itemType, itemData) => {
  try {
    const savedItemRef = doc(db, 'savedItems', `${userId}_${itemId}`);
    
    await setDoc(savedItemRef, {
      userId,
      itemId,
      itemType,
      title: itemData.title || '',
      description: itemData.description || itemData.summary || '',
      imageUrl: itemData.imageUrl || itemData.image || '',
      authorId: itemData.authorId || itemData.userId || '',
      authorName: itemData.authorName || itemData.displayName || '',
      campaignId: itemData.campaignId || null, // Store campaign ID for community posts
      savedAt: serverTimestamp(),
      collections: [], // Array of collection IDs this item belongs to
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving item:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsave/remove bookmark from an item
 * @param {string} userId - Current user ID
 * @param {string} itemId - Post/campaign ID
 */
export const unsaveItem = async (userId, itemId) => {
  try {
    const savedItemRef = doc(db, 'savedItems', `${userId}_${itemId}`);
    await deleteDoc(savedItemRef);
    return { success: true };
  } catch (error) {
    console.error('Error unsaving item:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if an item is saved
 * @param {string} userId - Current user ID
 * @param {string} itemId - Post/campaign ID
 */
export const isItemSaved = async (userId, itemId) => {
  try {
    const savedItemRef = doc(db, 'savedItems', `${userId}_${itemId}`);
    const docSnap = await getDoc(savedItemRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking saved status:', error);
    return false;
  }
};

/**
 * Get all saved items for a user
 * @param {string} userId - Current user ID
 * @param {string} collectionId - Optional: filter by collection ID
 */
export const getSavedItems = async (userId, collectionId = null) => {
  try {
    console.log(`🔍 Fetching saved items for user: ${userId}, collection: ${collectionId || 'all'}`);
    let q;
    if (collectionId) {
      q = query(
        collection(db, 'savedItems'),
        where('userId', '==', userId),
        where('collections', 'array-contains', collectionId),
        orderBy('savedAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'savedItems'),
        where('userId', '==', userId),
        orderBy('savedAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${items.length} saved items`);
    return items;
  } catch (error) {
    console.error('❌ Error getting saved items:', error);
    return [];
  }
};

/**
 * Create a new collection
 * @param {string} userId - Current user ID
 * @param {string} name - Collection name
 * @param {string} description - Optional description
 */
export const createCollection = async (userId, name, description = '') => {
  try {
    const collectionRef = await addDoc(collection(db, 'collections'), {
      userId,
      name,
      description,
      itemCount: 0,
      createdAt: serverTimestamp(),
    });

    return { success: true, collectionId: collectionRef.id };
  } catch (error) {
    console.error('Error creating collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all collections for a user
 * @param {string} userId - Current user ID
 */
export const getUserCollections = async (userId) => {
  try {
    console.log(`🔍 Fetching collections for user: ${userId}`);
    const q = query(
      collection(db, 'collections'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const collections = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${collections.length} collections`);
    return collections;
  } catch (error) {
    console.error('❌ Error getting collections:', error);
    return [];
  }
};

/**
 * Add a saved item to a collection
 * @param {string} userId - Current user ID
 * @param {string} itemId - Post/campaign ID
 * @param {string} collectionId - Collection ID
 */
export const addToCollection = async (userId, itemId, collectionId) => {
  try {
    const savedItemRef = doc(db, 'savedItems', `${userId}_${itemId}`);
    const collectionRef = doc(db, 'collections', collectionId);

    // Add collection ID to saved item
    await updateDoc(savedItemRef, {
      collections: arrayUnion(collectionId)
    });

    // Increment item count in collection
    await updateDoc(collectionRef, {
      itemCount: arrayUnion(itemId)
    });

    // Update itemCount to be the length
    const collectionSnap = await getDoc(collectionRef);
    const itemCountArray = collectionSnap.data()?.itemCount || [];
    await updateDoc(collectionRef, {
      itemCount: itemCountArray.length
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding to collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove a saved item from a collection
 * @param {string} userId - Current user ID
 * @param {string} itemId - Post/campaign ID
 * @param {string} collectionId - Collection ID
 */
export const removeFromCollection = async (userId, itemId, collectionId) => {
  try {
    const savedItemRef = doc(db, 'savedItems', `${userId}_${itemId}`);
    const collectionRef = doc(db, 'collections', collectionId);

    // Remove collection ID from saved item
    await updateDoc(savedItemRef, {
      collections: arrayRemove(collectionId)
    });

    // Decrement item count in collection
    await updateDoc(collectionRef, {
      itemCount: arrayRemove(itemId)
    });

    // Update itemCount to be the length
    const collectionSnap = await getDoc(collectionRef);
    const itemCountArray = collectionSnap.data()?.itemCount || [];
    await updateDoc(collectionRef, {
      itemCount: itemCountArray.length
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing from collection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a collection
 * @param {string} collectionId - Collection ID
 */
export const deleteCollection = async (collectionId) => {
  try {
    const collectionRef = doc(db, 'collections', collectionId);
    await deleteDoc(collectionRef);

    // Note: Items in this collection will still exist in savedItems,
    // they'll just no longer have this collectionId in their collections array

    return { success: true };
  } catch (error) {
    console.error('Error deleting collection:', error);
    return { success: false, error: error.message };
  }
};
