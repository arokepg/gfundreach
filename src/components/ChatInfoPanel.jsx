import { useEffect, useMemo, useState } from 'react';
import { X, Users, UserRound, Image as ImageIcon, Link as LinkIcon, Music2 } from 'lucide-react';
import ImageViewer from './ImageViewer';
import CampaignContextCard from './CampaignContextCard';
import { getConversation, getSharedMedia } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';

/**
 * ChatInfoPanel - right-side drawer for any conversation
 * Shows Shared Media (images, audio, campaigns) and Links for both direct and group chats.
 * Props:
 *  - conversationId: string
 *  - open: boolean
 *  - onClose: () => void
 */
const ChatInfoPanel = ({ conversationId, open, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [media, setMedia] = useState({ images: [], audios: [], campaigns: [], links: [] });
  const [imagePreview, setImagePreview] = useState({ open: false, src: '', alt: '' });

  const isGroup = useMemo(() => conv?.type === 'group' || (conv?.participants || []).length > 2, [conv]);

  useEffect(() => {
    if (!open || !conversationId) return;
    (async () => {
      setLoading(true);
      try {
        const c = await getConversation(conversationId);
        setConv(c);
        const m = await getSharedMedia(conversationId, 200);
        setMedia(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId]);

  if (!open) return null;

  const headerName = isGroup
    ? (conv?.settings?.name || conv?.groupName || 'Group Chat')
    : (() => {
        const otherId = (conv?.participants || []).find((id) => id !== currentUser?.uid);
        return conv?.participantNames?.[otherId] || 'User';
      })();

  const headerPhoto = isGroup
    ? (conv?.settings?.groupImageUrl || '')
    : (() => {
        const otherId = (conv?.participants || []).find((id) => id !== currentUser?.uid);
        return conv?.participantPhotos?.[otherId] || '';
      })();

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col animate-slideUp overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {isGroup ? <Users size={22} /> : <UserRound size={22} />} Chat Info
          </h3>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600 dark:text-gray-400">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Header info */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {headerPhoto ? (
                  <img src={headerPhoto} alt={headerName} className="w-full h-full object-cover" />
                ) : (
                  isGroup ? <Users size={28} className="text-gray-500 dark:text-gray-400" /> : <UserRound size={28} className="text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-lg truncate">{headerName}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{isGroup ? `${(conv?.participants || []).length} members` : 'Direct chat'}</div>
              </div>
            </div>

            {/* Shared Media */}
            <div className="p-6 space-y-6">
              {/* Images */}
              {media.images.length>0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><ImageIcon size={18}/>Images</div>
                  <div className="grid grid-cols-3 gap-3">
                    {media.images.map(img => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt="shared"
                        className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-zoom-in"
                        onClick={() => setImagePreview({ open: true, src: img.url, alt: 'Shared image' })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Audio */}
              {media.audios.length>0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><Music2 size={18}/>Audio</div>
                  <div className="space-y-2">
                    {media.audios.map(a => (
                      <audio key={a.id} controls src={a.url} className="w-full" />
                    ))}
                  </div>
                </div>
              )}

              {/* Campaigns */}
              {media.campaigns.length>0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Campaigns</div>
                  <div className="space-y-3">
                    {media.campaigns.map(c => (
                      <CampaignContextCard key={c.id} campaign={c.campaign} />
                    ))}
                  </div>
                </div>
              )}

              {/* Links */}
              {media.links.length>0 && (
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><LinkIcon size={18}/>Links</div>
                  <ul className="space-y-2 text-sm">
                    {media.links.map(l => (
                      <li key={l.id} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800"><a className="text-blue-600 dark:text-blue-400 hover:underline break-all" href={l.url} target="_blank" rel="noreferrer">{l.url}</a></li>
                    ))}
                  </ul>
                </div>
              )}

              {media.images.length===0 && media.audios.length===0 && media.campaigns.length===0 && media.links.length===0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">No shared media yet.</div>
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
  );
};

export default ChatInfoPanel;
