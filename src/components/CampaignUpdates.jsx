import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, query, orderBy, getDocs, serverTimestamp, updateDoc, doc, increment, deleteDoc, getDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { createNotification, createOrGroupLikeNotification } from '../utils/notifications';
import { saveItem, unsaveItem, isItemSaved } from '../utils/savedItems';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';

const CampaignUpdates = ({ campaignId, onUpdateCountChange }) => {
  const { currentUser, userProfile } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [savedPosts, setSavedPosts] = useState({}); // Track saved status for each post
  const [likedPosts, setLikedPosts] = useState({}); // Track like status per post
  const [likesCounts, setLikesCounts] = useState({}); // Track like counts per post
  const [sharesCounts, setSharesCounts] = useState({}); // Track share counts per post
  const [updateCity, setUpdateCity] = useState('');
  const [updateCountry, setUpdateCountry] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Check saved status for all posts
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!currentUser || updates.length === 0) return;
      
      const savedStatus = {};
      for (const update of updates) {
        const saved = await isItemSaved(currentUser.uid, update.id);
        savedStatus[update.id] = saved;
      }
      setSavedPosts(savedStatus);
    };
    
    checkSavedStatus();
  }, [currentUser, updates]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      const q = query(
        collection(db, 'posts', campaignId, 'updates'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUpdates(list);

      // Initialize reaction state maps
      const initialLiked = {};
      const initialLikes = {};
      const initialShares = {};
      for (const u of list) {
        const likedBy = Array.isArray(u.likedBy) ? u.likedBy : [];
        initialLiked[u.id] = currentUser ? likedBy.includes(currentUser.uid) : false;
        initialLikes[u.id] = typeof u.likesCount === 'number' ? u.likesCount : (likedBy.length || 0);
        initialShares[u.id] = typeof u.sharesCount === 'number' ? u.sharesCount : 0;
      }
      setLikedPosts(initialLiked);
      setLikesCounts(initialLikes);
      setSharesCounts(initialShares);
    } catch (e) {
      console.error('Failed to load posts', e);
      // Don't show error to user - just log it and show empty state
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Post content is required');
      return;
    }
    if (!currentUser) {
      setError('You must be logged in to post');
      return;
    }
    try {
      setError('');
      setCreating(true);

      let imageUrl = '';
      let parentTitle = '';
      // Fetch parent campaign title for easier feed rendering
      try {
        const parentSnap = await getDoc(doc(db, 'posts', campaignId));
        if (parentSnap.exists()) {
          parentTitle = parentSnap.data()?.title || '';
        }
      } catch (err) {
        console.warn('Failed to fetch parent campaign title', err);
      }
      // Upload image if provided
      if (image) {
        const imageRef = ref(storage, `community-posts/${campaignId}/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, 'posts', campaignId, 'updates'), {
        content: content.trim(),
        imageUrl,
        authorId: currentUser.uid,
        authorName: (userProfile?.displayName || currentUser.displayName || currentUser.email || 'Anonymous'),
        authorPhoto: currentUser.photoURL || '',
        campaignTitle: parentTitle,
        locationCity: updateCity || '',
        locationCountry: updateCountry || '',
        createdAt: serverTimestamp(),
      });
      
      // Best-effort: update campaign aggregate fields
      try {
        await updateDoc(doc(db, 'posts', campaignId), {
          updateCount: increment(1),
          lastUpdateAt: serverTimestamp(),
          lastUpdatePreview: content.trim().slice(0, 160),
        });
      } catch (aggErr) {
        console.warn('Aggregate update failed (non-fatal):', aggErr);
      }

      // Best-effort: campaign owner notification
      try {
        const campaignDoc = await getDoc(doc(db, 'posts', campaignId));
        if (campaignDoc.exists()) {
          const campaignData = campaignDoc.data();
          await createNotification(campaignData.authorId, 'comment', {
            senderId: currentUser.uid,
            senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
            postId: campaignId,
            postTitle: campaignData.title
          });
          // Also notify followers of the campaign about the new community post (best-effort)
          try {
            const followersQ = query(
              collection(db, 'savedItems'),
              where('itemType', '==', 'campaign'),
              where('itemId', '==', campaignId)
            );
            const followersSnap = await getDocs(followersQ);
            const notifyPromises = followersSnap.docs
              .map(d => d.data())
              .filter(s => s.userId && s.userId !== currentUser.uid)
              .map(s => createNotification(s.userId, 'community_post', {
                senderId: currentUser.uid,
                senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
                postId: campaignId,
                postTitle: campaignData.title
              }));
            await Promise.allSettled(notifyPromises);
          } catch (e) {
            console.warn('Notify followers failed (non-fatal):', e);
          }
        }
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr);
      }

      setContent('');
  setImage(null);
      setImagePreview(null);
  setUpdateCity('');
  setUpdateCountry('');
      await fetchUpdates();
      
      // Notify parent component of count change
      if (onUpdateCountChange) {
        onUpdateCountChange(updates.length + 1);
      }
    } catch (e) {
      console.error('Failed to create post', e);
      // Only surface errors from the create operation; aggregates/notifications are non-fatal above
      if (e.code === 'permission-denied') {
        setError('Permission denied. Please check Firestore security rules.');
      } else if (e.message) {
        setError(`Failed to create post: ${e.message}`);
      } else {
        setError('Failed to create post. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleEditPost = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditImagePreview(post.imageUrl || null);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditImage(null);
    setEditImagePreview(null);
    setError('');
  };

  const handleUpdatePost = async (postId) => {
    if (!editContent.trim()) {
      setError('Post content is required');
      return;
    }
    try {
      setError('');
      setUpdating(true);

      let imageUrl = editImagePreview;
      // Upload new image if changed
      if (editImage) {
        const imageRef = ref(storage, `community-posts/${campaignId}/${Date.now()}_${editImage.name}`);
        await uploadBytes(imageRef, editImage);
        imageUrl = await getDownloadURL(imageRef);
      }

      await updateDoc(doc(db, 'posts', campaignId, 'updates', postId), {
        content: editContent.trim(),
        imageUrl: imageUrl || '',
        updatedAt: serverTimestamp(),
      });

      setEditingPostId(null);
      setEditContent('');
      setEditImage(null);
      setEditImagePreview(null);
      await fetchUpdates();
    } catch (e) {
      console.error('Failed to update post', e);
      setError('Failed to update post. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
    try {
      await deleteDoc(doc(db, 'posts', campaignId, 'updates', postId));
      await updateDoc(doc(db, 'posts', campaignId), {
        updateCount: increment(-1),
      });
      await fetchUpdates();
      
      // Notify parent component of count change
      if (onUpdateCountChange) {
        onUpdateCountChange(updates.length - 1);
      }
    } catch (e) {
      console.error('Failed to delete post', e);
      setError('Failed to delete post. Please try again.');
    }
  };

  const handleSavePost = async (post) => {
    if (!currentUser) {
      alert('Please log in to save this post');
      return;
    }

    try {
      const isSaved = savedPosts[post.id];
      
      if (isSaved) {
        // Unsave
        await unsaveItem(currentUser.uid, post.id);
        setSavedPosts(prev => ({ ...prev, [post.id]: false }));
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      } else {
        // Save
        // Determine parent campaign type (regular vs group) to label saved item
        let parentGroup = false;
        try {
          const parentSnap = await getDoc(doc(db, 'posts', campaignId));
          parentGroup = !!parentSnap.data()?.groupId;
        } catch (e) {
          // Non-fatal: couldn't determine parent group
          console.warn('Failed to determine parent group (non-fatal):', e);
        }
        await saveItem(currentUser.uid, post.id, (parentGroup ? 'group_community_post' : 'community_post'), {
          title: post.content?.substring(0, 100) || 'Community post',
          description: post.content || '',
          imageUrl: post.imageUrl || '',
          authorId: post.authorId,
          authorName: post.authorName,
          campaignId: campaignId, // Include campaign ID so we can fetch the post later
          groupId: parentGroup ? (await getDoc(doc(db, 'posts', campaignId))).data()?.groupId || null : null,
        });
        setSavedPosts(prev => ({ ...prev, [post.id]: true }));
        queryClient.invalidateQueries({ queryKey: ['savedItems'] });
        queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser.uid] });
      }
    } catch (error) {
      console.error('Error saving post:', error);
      alert('Failed to save post. Please try again.');
    }
  };

  const handleLikePost = async (post) => {
    if (!currentUser) {
      alert('Please log in to like this post');
      return;
    }
    try {
      const postRef = doc(db, 'posts', campaignId, 'updates', post.id);
      const isLiked = !!likedPosts[post.id];
      if (isLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1),
        });
        setLikedPosts(prev => ({ ...prev, [post.id]: false }));
        setLikesCounts(prev => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] || 1) - 1) }));
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1),
        });
        setLikedPosts(prev => ({ ...prev, [post.id]: true }));
        setLikesCounts(prev => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));
        // Best-effort: notify post author about like
        try {
          if (post.authorId && currentUser.uid !== post.authorId) {
            await createOrGroupLikeNotification(post.authorId, {
              senderId: currentUser.uid,
              senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
              postId: post.id,
              postTitle: post.campaignTitle || ''
            });
          }
        } catch (e) {
          console.warn('Like notification failed (non-fatal):', e);
        }
      }
    } catch (err) {
      console.error('Failed to toggle like', err);
    }
  };

  const handleSharePost = async (post) => {
    try {
      const postRef = doc(db, 'posts', campaignId, 'updates', post.id);
      // Best-effort: increment share count (may fail due to auth rules)
      try {
        await updateDoc(postRef, { sharesCount: increment(1) });
        setSharesCounts(prev => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));
      } catch (shareErr) {
        console.warn('Share count increment failed (non-fatal):', shareErr);
      }
      const url = `${window.location.origin}/community-post/${campaignId}/${post.id}`;
      if (navigator.share) {
        await navigator.share({ title: post.campaignTitle || 'Community post', text: post.content, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      }
      // Best-effort: notify post author about share
      try {
        if (post.authorId && currentUser?.uid !== post.authorId) {
          await createNotification(post.authorId, 'share', {
            senderId: currentUser?.uid,
            senderName: userProfile?.displayName || currentUser?.displayName || 'Someone',
            postId: post.id,
            postTitle: post.campaignTitle || ''
          });
        }
      } catch (e) {
        console.warn('Share notification failed (non-fatal):', e);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed', err);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-themed">Community posts</h3>
        <span className="text-sm text-themed-muted">{updates.length} posts</span>
      </div>

      {/* Post creation form - available to all logged-in users */}
      {currentUser && (
        <form onSubmit={handleCreatePost} className="mb-6 space-y-3">
          {error && (
            <div className="bg-error-50 border border-error text-error-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <PersonIcon className="text-gray-600 dark:text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                className="input-field min-h-[80px]"
                placeholder="Share your thoughts about this campaign..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="City (optional)"
                  value={updateCity}
                  onChange={(e)=> setUpdateCity(e.target.value)}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Country (optional)"
                  value={updateCountry}
                  onChange={(e)=> setUpdateCountry(e.target.value)}
                  className="input-field"
                />
              </div>
              
              {/* Image preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setImage(null); setImagePreview(null); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <CloseIcon fontSize="small" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="post-image-upload"
              />
              <label
                htmlFor="post-image-upload"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-themed-secondary rounded-lg cursor-pointer transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <ImageIcon fontSize="small" />
                Add Image
              </label>
            </div>
            <button type="submit" className="btn-primary px-6" disabled={creating}>
              {creating ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {!currentUser && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-sm text-themed-muted">
          Log in to share your thoughts about this campaign
        </div>
      )}

      {/* Posts feed */}
      {loading ? (
        <div className="text-sm text-themed-muted">Loading posts...</div>
      ) : updates.length === 0 ? (
        <div className="text-sm text-themed-muted text-center py-8">
          No posts yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map(upd => (
            <div key={upd.id} className="border border-outline-variant rounded-lg p-4">
              {editingPostId === upd.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {upd.authorPhoto ? (
                        <img
                          src={upd.authorPhoto}
                          alt={upd.authorName}
                          className="w-10 h-10 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <PersonIcon className="text-gray-600 dark:text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-themed text-sm">{upd.authorName || 'Anonymous'}</p>
                      <p className="text-xs text-themed-muted">Editing</p>
                    </div>
                  </div>
                  
                  <textarea
                    className="input-field min-h-[80px] w-full"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  
                  {/* Edit image preview */}
                  {editImagePreview && (
                    <div className="relative inline-block">
                      <img src={editImagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => { setEditImage(null); setEditImagePreview(upd.imageUrl || null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <CloseIcon fontSize="small" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageChange}
                        className="hidden"
                        id={`edit-image-${upd.id}`}
                      />
                      <label
                        htmlFor={`edit-image-${upd.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-themed-secondary rounded-lg cursor-pointer transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <ImageIcon fontSize="small" />
                        {editImagePreview ? 'Change Image' : 'Add Image'}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-sm text-themed-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        disabled={updating}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdatePost(upd.id)}
                        className="btn-primary px-4 py-2 text-sm"
                        disabled={updating}
                      >
                        {updating ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <>
                  {/* Author info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Link to={`/profile/${upd.authorId}`} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-90">
                      {upd.authorPhoto ? (
                        <img
                          src={upd.authorPhoto}
                          alt={upd.authorName}
                          className="w-10 h-10 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <PersonIcon className="text-gray-600 dark:text-gray-300" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${upd.authorId}`} className="font-semibold text-themed text-sm hover:underline">{upd.authorName || 'Anonymous'}</Link>
                      {upd.createdAt && (
                        <p className="text-xs text-themed-muted">
                          {upd.createdAt.toDate ? upd.createdAt.toDate().toLocaleString() : new Date(upd.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1">
                      {/* Bookmark button for all users */}
                      <button
                        onClick={() => handleSavePost(upd)}
                        className="p-2 text-themed-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title={savedPosts[upd.id] ? 'Remove bookmark' : 'Bookmark post'}
                      >
                        {savedPosts[upd.id] ? (
                          <BookmarkIcon fontSize="small" className="text-yellow-500" />
                        ) : (
                          <BookmarkBorderIcon fontSize="small" />
                        )}
                      </button>
                      
                      {/* Edit/Delete buttons for post author */}
                      {currentUser?.uid === upd.authorId && (
                        <>
                          <button
                            onClick={() => handleEditPost(upd)}
                            className="p-2 text-themed-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit post"
                          >
                            <EditIcon fontSize="small" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(upd.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete post"
                          >
                            <DeleteIcon fontSize="small" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Post content */}
                  <p className="text-sm text-themed-secondary whitespace-pre-wrap">{upd.content}</p>
                  
                  {/* Post image */}
                  {upd.imageUrl && (
                    <img
                      src={upd.imageUrl}
                      alt="Post attachment"
                      className="mt-3 rounded-lg max-w-full h-auto"
                    />
                  )}

                  {/* Reactions */}
                  <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-4">
                    <button
                      onClick={() => handleLikePost(upd)}
                      className={`flex items-center gap-1 bg-transparent hover:bg-transparent focus:bg-transparent transition-all duration-300 ${
                        likedPosts[upd.id] ? 'text-red-600' : 'text-themed-secondary hover:text-red-500 dark:hover:text-red-400'
                      }`}
                    >
                      {likedPosts[upd.id] ? (
                        <FavoriteIcon fontSize="small" />
                      ) : (
                        <FavoriteBorderIcon fontSize="small" />
                      )}
                      <span className="text-xs font-medium">{likesCounts[upd.id] || 0}</span>
                    </button>
                    <button
                      onClick={() => handleSharePost(upd)}
                      className="flex items-center gap-1 text-themed-secondary hover:text-green-600 dark:hover:text-green-400 transition-all duration-300"
                    >
                      <ShareIcon fontSize="small" />
                      <span className="text-xs font-medium">{sharesCounts[upd.id] || 0}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignUpdates;
