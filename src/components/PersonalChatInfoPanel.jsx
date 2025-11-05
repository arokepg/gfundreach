import { useEffect, useState } from 'react';
import { default as X } from '@mui/icons-material/Close';
import { default as User } from '@mui/icons-material/Person';
import { default as ImageIcon } from '@mui/icons-material/Image';
import { default as ExternalLink } from '@mui/icons-material/OpenInNew';
import { default as LinkIcon } from '@mui/icons-material/Link';
import { default as Music2 } from '@mui/icons-material/MusicNote';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getSharedMedia } from '../utils/messaging';
import { useTheme } from '../contexts/ThemeContext';
import CampaignContextCard from './CampaignContextCard';
import ImageViewer from './ImageViewer';

const PersonalChatInfoPanel = ({ conversationId, otherUser, open, onClose }) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState({ images: [], audios: [], campaigns: [], links: [] });
  const [imagePreview, setImagePreview] = useState({ open: false, src: '', alt: '' });

  useEffect(() => {
    if (!open || !conversationId) return;
    
    (async () => {
      setLoading(true);
      try {
        const m = await getSharedMedia(conversationId, 200);
        setMedia(m);
      } catch (error) {
        console.error('Error loading shared media:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId]);

  if (!open) return null;

  const panelClass = isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
  <aside className={`relative w-full max-w-2xl h-[90vh] ${panelClass} rounded-2xl shadow-2xl flex flex-col animate-slideUp overflow-hidden`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User size={22} /> Chat Info
          </h3>
          <button 
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
            onClick={onClose} 
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* User Profile Section */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {otherUser?.photo ? (
                  <img src={otherUser.photo} alt={otherUser.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-xl">{otherUser?.name || 'Unknown User'}</div>
              </div>
              
              {/* View Profile Button */}
              {otherUser?.id && (
                <button
                  onClick={() => {
                    navigate(`/profile/${otherUser.id}`);
                    onClose();
                  }}
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center gap-2"
                >
                  <ExternalLink size={18} />
                  View Full Profile
                </button>
              )}
            </div>

            {/* Shared Media Section */}
            <div className="p-6 space-y-6">
              {/* Shared Images */}
              {media.images.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <ImageIcon size={18} />
                    Shared Images ({media.images.length})
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {media.images.map(img => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt="shared"
                        className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-75 transition-opacity"
                        onClick={() => setImagePreview({ open: true, src: img.url, alt: 'Shared image' })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Audio */}
              {media.audios.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Music2 size={18} />
                    Shared Audio ({media.audios.length})
                  </div>
                  <div className="space-y-2">
                    {media.audios.map(a => (
                      <audio key={a.id} controls src={a.url} className="w-full" />
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Campaigns */}
              {media.campaigns.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Shared Campaigns ({media.campaigns.length})
                  </div>
                  <div className="space-y-3">
                    {media.campaigns.map(c => (
                      <CampaignContextCard key={c.id} campaign={c.campaign} />
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Links */}
              {media.links.length > 0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <LinkIcon size={18} />
                    Shared Links ({media.links.length})
                  </div>
                  <ul className="space-y-2 text-sm">
                    {media.links.map(l => (
                      <li key={l.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <a 
                          className="text-blue-600 dark:text-blue-400 hover:underline break-all flex items-center gap-2" 
                          href={l.url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          <ExternalLink size={16} />
                          {l.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {media.images.length === 0 && media.audios.length === 0 && media.campaigns.length === 0 && media.links.length === 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                  No shared media yet.
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
      <ImageViewer
        open={imagePreview.open}
        src={imagePreview.src}
        alt={imagePreview.alt}
        onClose={() => setImagePreview({ open: false, src: '', alt: '' })}
      />
    </div>
  , document.body);
};

export default PersonalChatInfoPanel;
