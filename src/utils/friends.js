import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './notifications';

// Deterministic friendship id for a pair of users
const pairId = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}_${y}`;
};

const refFor = (a, b) => doc(db, 'friendships', pairId(a, b));

export const getFriendshipStatus = async (me, other) => {
  if (!me || !other || me === other) return { status: 'self' };
  const ref = refFor(me, other);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { status: 'none' };
  const data = snap.data() || {};
  if (data.status === 'accepted') return { status: 'friends' };
  if (data.status === 'pending') {
    if (data.requestedBy === me) return { status: 'pending-sent' };
    return { status: 'pending-received' };
  }
  return { status: 'none' };
};

export const sendFriendRequest = async (me, other, senderName) => {
  const ref = refFor(me, other);
  await setDoc(ref, {
    users: [me, other].sort(),
    status: 'pending',
    requestedBy: me,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Create notification for friend request
  await createNotification(other, 'friend_request', {
    senderId: me,
    senderName: senderName || 'Someone',
  });
};

export const acceptFriendRequest = async (me, other, accepterName) => {
  const ref = refFor(me, other);
  await setDoc(ref, {
    users: [me, other].sort(),
    status: 'accepted',
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Create notification for friend request acceptance
  await createNotification(other, 'friend_accepted', {
    senderId: me,
    senderName: accepterName || 'Someone',
  });
};

export const cancelFriendRequest = async (me, other) => {
  const ref = refFor(me, other);
  await deleteDoc(ref);
};

export const removeFriend = async (me, other) => {
  const ref = refFor(me, other);
  await deleteDoc(ref);
};

// List accepted friends for a user, returning an array of userIds
export const listFriendIds = async (me) => {
  if (!me) return [];
  // Primary query: status==accepted AND users array-contains me (needs composite). Fallback: only array-contains.
  const col = collection(db, 'friendships');
  let snap;
  try {
    snap = await getDocs(query(col, where('status', '==', 'accepted'), where('users', 'array-contains', me)));
  } catch {
    snap = await getDocs(query(col, where('users', 'array-contains', me)));
  }
  const ids = new Set();
  snap.docs.forEach(d => {
    const data = d.data() || {};
    if (data.status === 'accepted' && Array.isArray(data.users)) {
      const other = data.users.find((u) => u !== me);
      if (other) ids.add(other);
    }
  });
  return Array.from(ids);
};

