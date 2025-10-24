import { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, getDocs, serverTimestamp, updateDoc, doc, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotification } from '../utils/notifications';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';

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

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

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
        authorName: currentUser.displayName || 'Anonymous',
        authorPhoto: currentUser.photoURL || '',
        createdAt: serverTimestamp(),
      });

      // Update campaign aggregate fields
      await updateDoc(doc(db, 'posts', campaignId), {
        updateCount: increment(1),
        lastUpdateAt: serverTimestamp(),
        lastUpdatePreview: content.trim().slice(0, 160),
      });

      // Get campaign details to notify the owner
      const campaignDoc = await getDoc(doc(db, 'posts', campaignId));
      if (campaignDoc.exists()) {
        const campaignData = campaignDoc.data();
        
        // Create notification for campaign owner (if commenter is not the owner)
        await createNotification(campaignData.authorId, 'comment', {
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || currentUser.displayName || 'Someone',
          postId: campaignId,
          postTitle: campaignData.title
        });
      }

      setContent('');
      setImage(null);
      setImagePreview(null);
      await fetchUpdates();
      
      // Notify parent component of count change
      if (onUpdateCountChange) {
        onUpdateCountChange(updates.length + 1);
      }
    } catch (e) {
      console.error('Failed to create post', e);
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
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-themed-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
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
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-themed-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
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
                      {upd.createdAt && (
                        <p className="text-xs text-themed-muted">
                          {upd.createdAt.toDate ? upd.createdAt.toDate().toLocaleString() : new Date(upd.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {/* Edit/Delete buttons for post author */}
                    {currentUser?.uid === upd.authorId && (
                      <div className="flex gap-1">
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
                      </div>
                    )}
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
