import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
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
  const [sentToChats, setSentToChats] = useState(new Set()); // Track which chats we've sent to

  useEffect(() => {
    if (!open || !currentUser?.uid) return;
    let mounted = true;
    // Reset sent tracking when modal opens
    setSentToChats(new Set());
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
      
      console.log('Sharing post:', post);
      console.log('Is update?', post.isUpdate, 'Campaign ID:', post.campaignId);
      
      // For campaign updates, we need to fetch the parent campaign data first
      let campaignData;
      if (post.isUpdate && post.campaignId) {
        // This is an update - fetch the parent campaign
        console.log('Fetching parent campaign:', post.campaignId);
        const campaignDoc = await getDoc(doc(db, 'posts', post.campaignId));
        console.log('Campaign doc exists?', campaignDoc.exists());
        
        if (campaignDoc.exists()) {
          const data = campaignDoc.data();
          console.log('Campaign data:', data);
          
          campaignData = {
            id: post.campaignId,
            title: data.title || 'Campaign',
            description: data.description || data.summary || '',
            imageUrl: data.imageUrl || data.image || '',
            category: data.category || '',
            currentAmount: data.currentAmount || 0,
            goalAmount: data.goalAmount || 0,
            supporters: data.supporters || 0,
          };
        } else {
          throw new Error('Campaign not found');
        }
      } else {
        // This is a full campaign post
        campaignData = {
          id: post.id,
          title: post.title || 'Campaign',
          description: post.description || post.summary || '',
          imageUrl: post.imageUrl || post.image || '',
          category: post.category || '',
          currentAmount: post.currentAmount || 0,
          goalAmount: post.goalAmount || 0,
          supporters: post.supporters || 0,
        };
      }
      
      console.log('Final campaign data to send:', campaignData);
      
      // Send as campaign card
      if (campaignData) {
        await sendCampaignCard(
          group.id,
          currentUser.uid,
          currentUser.displayName || 'You',
          campaignData
        );
        console.log('Campaign card sent successfully');
      }
      
      try {
        // Update share count on the correct document
        const docId = post.isUpdate && post.campaignId ? post.campaignId : post.id;
        await updateDoc(doc(db, 'posts', docId), { sharesCount: increment(1) });
      } catch (shareErr) {
        // non-fatal
        console.warn('Failed to increment share count', shareErr);
      }
      
      // Mark this chat as sent
      setSentToChats(prev => new Set([...prev, group.id]));
      
      // Show success message without closing modal
      alert('Sent to chat: ' + group.name);
      try { onShared?.(group); } catch (cbErr) { console.warn('onShared callback failed', cbErr); }
      // DO NOT close modal - user can continue sending to other chats
    } catch (err) {
      console.error('Send to chat failed:', err);
      console.error('Error details:', err.message, err.code);
      alert(`Failed to send to chat: ${err.message || 'Please try again'}`);
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
          <h3 className="text-lg font-semibold text-themed flex items-center gap-2"><Users size={18} /> Share to Chat</h3>
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
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="text-sm text-themed-muted">Loading conversations…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-themed-muted">
              {search ? 'No conversations found.' : 'No conversations yet. Start chatting with someone first!'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((g) => {
                const alreadySent = sentToChats.has(g.id);
                return (
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
                      disabled={!!sendingId || alreadySent}
                      className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 ${
                        alreadySent 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <SendIcon size={16} /> {sendingId === g.id ? 'Sending…' : alreadySent ? 'Sent ✓' : 'Send'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
            >
              <LinkIcon size={16} /> {copied ? 'Copied!' : 'Copy link'}
            </button>
            {sentToChats.size > 0 && (
              <span className="text-xs text-themed-muted">
                Shared to {sentToChats.size} chat{sentToChats.size > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ShareToChatModal;
