import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, User as UserIcon, Search, X, Send as SendIcon, Link as LinkIcon } from 'lucide-react';
import { sendCampaignCard } from '../utils/messaging';

const ShareToChatModal = ({ open, onClose, post, onShared }) => {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !currentUser?.uid) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const convRef = collection(db, 'conversations');
        const q = query(convRef, where('participants', 'array-contains', currentUser.uid));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Normalize to a common shape including both DMs and Groups
        const normalized = list.map((c) => {
          const isGroup = c.type === 'group' || (Array.isArray(c.participants) && c.participants.length > 2);
          if (isGroup) {
            return {
              id: c.id,
              type: 'group',
              name: c.settings?.name || c.groupName || 'Group',
              photo: c.settings?.groupImageUrl || '',
              count: (c.participants || []).length,
            };
          }
          // DM (1:1)
          const otherId = (c.participants || []).find((id) => id !== currentUser.uid) || '';
          return {
            id: c.id,
            type: 'dm',
            name: c.participantNames?.[otherId] || 'User',
            photo: c.participantPhotos?.[otherId] || '',
            count: (c.participants || []).length || 2,
          };
        });
        if (mounted) setGroups(normalized);
      } catch (err) {
        console.error('Load groups failed', err);
        if (mounted) setGroups([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, currentUser?.uid]);

  if (!open) return null;

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const handleSend = async (group) => {
    if (!currentUser || !post?.id) return;
    try {
      setSendingId(group.id);
      await sendCampaignCard(
        group.id,
        currentUser.uid,
        currentUser.displayName || 'You',
        {
          id: post.id,
          title: post.title || 'Campaign',
          description: post.description || post.summary || '',
          imageUrl: post.imageUrl || post.image || '',
          category: post.category || '',
          currentAmount: post.currentAmount || 0,
          goalAmount: post.goalAmount || 0,
          supporters: post.supporters || 0,
        }
      );
      try {
        await updateDoc(doc(db, 'posts', post.id), { sharesCount: increment(1) });
      } catch (shareErr) {
        // non-fatal
        console.warn('Failed to increment share count', shareErr);
      }
      alert('Sent to group: ' + group.name);
  try { onShared?.(group); } catch (cbErr) { console.warn('onShared callback failed', cbErr); }
      onClose?.();
    } catch (err) {
      console.error('Send to chat failed', err);
      alert('Failed to send to chat. Please try again.');
    } finally {
      setSendingId('');
    }
  };

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/post/${post?.id || ''}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn('Copy link failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-slideUp">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-themed flex items-center gap-2"><Users size={18} /> Share to group chat</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your groups..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="text-sm text-themed-muted">Loading groups…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-themed-muted">No groups found.</div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((g) => (
                <li key={g.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 min-w-0">
                    {g.photo ? (
                      <img src={g.photo} alt={g.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                        {g.type === 'group' ? <Users size={18} /> : <UserIcon size={18} />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-themed truncate" title={g.name}>{g.name}</div>
                      <div className="text-xs text-themed-muted">{g.type === 'group' ? `${g.count} members` : 'Direct chat'}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSend(g)}
                    disabled={!!sendingId}
                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    <SendIcon size={16} /> {sendingId === g.id ? 'Sending…' : 'Send'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <button
            onClick={copyLink}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
          >
            <LinkIcon size={16} /> {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ShareToChatModal;
