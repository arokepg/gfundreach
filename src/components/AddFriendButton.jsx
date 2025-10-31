import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFriendshipStatus, sendFriendRequest, acceptFriendRequest, cancelFriendRequest, removeFriend } from '../utils/friends';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const AddFriendButton = ({ targetUserId, targetName }) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [senderName, setSenderName] = useState('');

  const me = currentUser?.uid;
  const isSelf = me && targetUserId && me === targetUserId;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!me || !targetUserId || isSelf) {
        setStatus(isSelf ? 'self' : 'none');
        return;
      }
      try {
        const s = await getFriendshipStatus(me, targetUserId);
        if (mounted) setStatus(s.status);
        
        // Fetch current user's name for notifications
        const userDoc = await getDoc(doc(db, 'users', me));
        if (mounted && userDoc.exists()) {
          setSenderName(userDoc.data().name || 'Someone');
        }
      } catch {
        if (mounted) setStatus('none');
      }
    };
    load();
    return () => { mounted = false; };
  }, [me, targetUserId, isSelf]);

  if (!me || isSelf) return null;

  const base = `inline-flex items-center rounded-lg border px-3 py-2 text-sm transition-colors ${busy ? 'opacity-60 pointer-events-none' : ''}`;

  const handleSend = async () => {
    setBusy(true);
    try { await sendFriendRequest(me, targetUserId, senderName); setStatus('pending-sent'); } finally { setBusy(false); }
  };
  const handleAccept = async () => {
    setBusy(true);
    try { await acceptFriendRequest(me, targetUserId, senderName); setStatus('friends'); } finally { setBusy(false); }
  };
  const handleCancel = async () => {
    setBusy(true);
    try { await cancelFriendRequest(me, targetUserId); setStatus('none'); } finally { setBusy(false); }
  };
  const handleUnfriend = async () => {
    setBusy(true);
    try { await removeFriend(me, targetUserId); setStatus('none'); } finally { setBusy(false); }
  };

  switch (status) {
    case 'friends':
      return (
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-sm">Friends</span>
          <button onClick={handleUnfriend} className={`${base} border-red-200 text-red-600 hover:bg-red-50`}>Unfriend</button>
        </div>
      );
    case 'pending-sent':
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">Requested</span>
          <button onClick={handleCancel} className={`${base} border-gray-300 hover:bg-gray-50`}>Cancel</button>
        </div>
      );
    case 'pending-received':
      return (
        <div className="flex items-center gap-2">
          <button onClick={handleAccept} className={`${base} border-green-300 text-green-700 hover:bg-green-50`}>Accept</button>
          <button onClick={handleCancel} className={`${base} border-gray-300 hover:bg-gray-50`}>Decline</button>
        </div>
      );
    default:
      return (
        <button onClick={handleSend} className={`${base} border-blue-300 text-blue-700 hover:bg-blue-50`}>
          Add Friend{targetName ? ` • ${targetName}` : ''}
        </button>
      );
  }
};

export default AddFriendButton;
