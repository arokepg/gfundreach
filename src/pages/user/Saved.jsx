import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getSavedItems, getUserCollections, createCollection, addToCollection, removeFromCollection, deleteCollection, unsaveItem } from '../../utils/savedItems';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderIcon from '@mui/icons-material/Folder';
import ShareIcon from '@mui/icons-material/Share';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Saved = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  // Queries
  const savedQuery = useQuery({
    queryKey: ['savedItems', currentUser?.uid, selectedCollection],
    queryFn: () => getSavedItems(currentUser.uid, selectedCollection),
    enabled: !!currentUser,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const collectionsQuery = useQuery({
    queryKey: ['collections', currentUser?.uid],
    queryFn: () => getUserCollections(currentUser.uid),
    enabled: !!currentUser,
  });

  const savedItems = savedQuery.data || [];
  const collections = collectionsQuery.data || [];
  const loading = savedQuery.isLoading || collectionsQuery.isLoading;

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const result = await createCollection(currentUser.uid, newCollectionName, newCollectionDesc);
      if (result.success) {
        setNewCollectionName('');
        setNewCollectionDesc('');
        setShowCreateModal(false);
        queryClient.invalidateQueries({ queryKey: ['collections', currentUser?.uid] });
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await deleteCollection(collectionId);
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
      queryClient.invalidateQueries({ queryKey: ['collections', currentUser?.uid] });
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  };

  const handleUnsaveItem = async (itemId) => {
    try {
      await unsaveItem(currentUser.uid, itemId.split('_')[1]);
      queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser?.uid] });
    } catch (error) {
      console.error('Error unsaving item:', error);
    }
  };

  const handleAddToCollection = async (collectionId) => {
    if (!selectedItem) return;

    try {
      const itemId = selectedItem.itemId;
      await addToCollection(currentUser.uid, itemId, collectionId);
      setShowAddToCollectionModal(false);
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser?.uid] });
    } catch (error) {
      console.error('Error adding to collection:', error);
    }
  };

  const handleRemoveFromCollection = async (itemId, collectionId) => {
    try {
      await removeFromCollection(currentUser.uid, itemId, collectionId);
      queryClient.invalidateQueries({ queryKey: ['savedItems', currentUser?.uid] });
    } catch (error) {
      console.error('Error removing from collection:', error);
    }
  };

  const handleFilterByCollection = (collectionId) => {
    setSelectedCollection(collectionId);
  };

  // Removed unused handleShowAll to satisfy linter

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 lg:order-1">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h1 className="text-2xl font-bold text-themed">
                {selectedCollection
                  ? collections.find((c) => c.id === selectedCollection)?.name
                  : 'All saved items'}
              </h1>
              <p className="text-sm text-themed-muted whitespace-nowrap">
                {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="mt-4 text-themed-muted">Loading saved items...</p>
              </div>
            ) : savedItems.length === 0 ? (
              <div className="text-center py-12 card">
                <BookmarkBorderIcon sx={{ fontSize: 60 }} className="text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-themed mb-2">No saved items</h3>
                <p className="text-themed-muted mb-6">
                  Start saving campaigns by clicking the bookmark icon on any post
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full transition-colors"
                >
                  Explore Campaigns
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {savedItems.map((item) => (
                  <div key={item.id} className="card overflow-hidden group relative p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <Link
                        to={(() => {
                          if ((item.itemType === 'community_post' || item.itemType === 'group_community_post') && item.campaignId) {
                            return `/community-post/${item.campaignId}/${item.itemId}`;
                          }
                          if (item.itemType === 'post' && item.campaignId) {
                            // Legacy saved community post
                            return `/community-post/${item.campaignId}/${item.itemId}`;
                          }
                          return `/post/${item.itemId}`;
                        })()}
                        className="sm:w-56 h-40 sm:h-36 block flex-shrink-0"
                      >
                        <div className="w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--hover-bg)' }}>
                              <BookmarkIcon sx={{ fontSize: 36 }} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                      </Link>
                      {/* Info + Actions */}
                      <div className="flex-1 p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              to={(() => {
                                switch (item.itemType) {
                                  case 'community_post':
                                  case 'group_community_post':
                                    return `/community-post/${item.campaignId}/${item.itemId}`;
                                  default:
                                    return `/post/${item.itemId}`;
                                }
                              })()}
                            >
                              <h3 className="font-semibold text-themed text-base sm:text-lg truncate hover:text-green-600 dark:hover:text-green-400 transition-colors">
                                {item.title}
                              </h3>
                            </Link>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              item.itemType === 'campaign' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                : item.itemType === 'group_campaign' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                : item.itemType === 'group_community_post' || (item.itemType === 'post' && item.campaignId) ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                                : item.itemType === 'community_post' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}>
                              {item.itemType === 'campaign' && 'Campaign'}
                              {item.itemType === 'group_campaign' && 'Group Campaign'}
                              {(item.itemType === 'community_post') && 'Community Post'}
                              {(item.itemType === 'group_community_post') && 'Group Community Post'}
                              {(item.itemType === 'post' && item.campaignId) && 'Community Post'}
                              {(!['campaign','group_campaign','community_post','group_community_post','post'].includes(item.itemType)) && 'Saved'}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-themed-muted line-clamp-2 mb-2">{item.description}</p>
                          )}
                          <div className="text-xs text-themed-muted">Saved from {item.authorName}</div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAddToCollectionModal(true);
                            }}
                            className="px-3 py-2 text-themed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                            style={{ backgroundColor: 'var(--hover-bg)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--input-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                          >
                            <FolderIcon fontSize="small" />
                            Add to collection
                          </button>
                          <button
                            onClick={() => handleUnsaveItem(item.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove from saved"
                          >
                            <DeleteIcon fontSize="small" className="text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collections Sidebar - Now on the right */}
          <div className="lg:w-64 flex-shrink-0 lg:order-2">
            <div className="card p-4 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-themed">My collections</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1 rounded-full transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <AddIcon className="text-green-600" />
                </button>
              </div>

              {/* Collection List */}
              <div className="space-y-1">
                {/* All Saved Collections Option */}
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    selectedCollection === null
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'text-themed'
                  }`}
                  style={selectedCollection !== null ? { backgroundColor: 'transparent' } : {}}
                  onMouseEnter={(e) => { if (selectedCollection !== null) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                  onMouseLeave={(e) => { if (selectedCollection !== null) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <button
                    onClick={() => setSelectedCollection(null)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <BookmarkIcon fontSize="small" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">All saved items</p>
                      <p className="text-xs text-themed-muted">{savedItems.length} items</p>
                    </div>
                  </button>
                </div>

                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg group transition-colors ${
                      selectedCollection === collection.id
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'text-themed'
                    }`}
                    style={selectedCollection !== collection.id ? { backgroundColor: 'transparent' } : {}}
                    onMouseEnter={(e) => { if (selectedCollection !== collection.id) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                    onMouseLeave={(e) => { if (selectedCollection !== collection.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <button
                      onClick={() => handleFilterByCollection(collection.id)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <FolderIcon fontSize="small" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collection.name}</p>
                        <p className="text-xs text-themed-muted">Only me</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteCollection(collection.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-opacity"
                    >
                      <DeleteIcon fontSize="small" className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>

              {/* See More */}
              {collections.length === 0 && (
                <p className="text-xs text-themed-muted text-center py-4">
                  No collections yet. Create one to organize your saved items!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-themed">Create a new collection</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCollectionName('');
                  setNewCollectionDesc('');
                }}
                className="p-1 rounded-full transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Name</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g., Medical Campaigns"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-themed mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="What's this collection about?"
                  className="input-field resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCollectionName('');
                    setNewCollectionDesc('');
                  }}
                  className="flex-1 px-4 py-2 text-themed rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: 'var(--hover-bg)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--input-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Collection Modal */}
      {showAddToCollectionModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-themed">Add to collection</h2>
              <button
                onClick={() => {
                  setShowAddToCollectionModal(false);
                  setSelectedItem(null);
                }}
                className="p-1 rounded-full transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <CloseIcon />
              </button>
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-themed-muted mb-4">You don't have any collections yet</p>
                <button
                  onClick={() => {
                    setShowAddToCollectionModal(false);
                    setShowCreateModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create a collection
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {collections.map((collection) => {
                  const isInCollection = selectedItem.collections?.includes(collection.id);
                  return (
                    <button
                      key={collection.id}
                      onClick={() => {
                        if (isInCollection) {
                          handleRemoveFromCollection(selectedItem.itemId, collection.id);
                        } else {
                          handleAddToCollection(collection.id);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isInCollection
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'text-themed'
                      }`}
                      style={!isInCollection ? { backgroundColor: 'transparent' } : {}}
                      onMouseEnter={(e) => { if (!isInCollection) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                      onMouseLeave={(e) => { if (!isInCollection) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <FolderIcon />
                      <div className="flex-1 text-left">
                        <p className="font-medium">{collection.name}</p>
                        {collection.description && (
                          <p className="text-sm text-themed-muted">{collection.description}</p>
                        )}
                      </div>
                      {isInCollection && <BookmarkIcon className="text-green-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Saved;
