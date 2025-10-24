import { db, storage } from '../config/firebase';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, orderBy, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Create a group with name, description and optional banner file
export const createGroup = async (ownerId, { name, description = '', bannerFile = null }) => {
  const groupData = {
    name,
    description,
    ownerId,
    createdAt: serverTimestamp(),
    memberCount: 1,
    postCount: 0,
    bannerUrl: '',
    privacy: 'public',
    requireApproval: true,
    deleted: false,
  };

  const groupRef = await addDoc(collection(db, 'groups'), groupData);

  // Upload banner if provided
  if (bannerFile) {
    const bannerRef = ref(storage, `groups/${groupRef.id}/banner_${Date.now()}`);
    await uploadBytes(bannerRef, bannerFile);
    const url = await getDownloadURL(bannerRef);
    await updateDoc(groupRef, { bannerUrl: url });
  }

  // Add owner as admin member with profile info
  let displayName = 'User';
  let photoURL = '';
  try {
    const userSnap = await getDoc(doc(db, 'users', ownerId));
    if (userSnap.exists()) {
      const u = userSnap.data();
      displayName = u.displayName || u.email || 'User';
      photoURL = u.photoURL || '';
    }
  } catch { /* ignore profile fetch errors */ }

  await setDoc(doc(db, 'groups', groupRef.id, 'members', ownerId), {
    userId: ownerId,
    role: 'admin',
    joinedAt: serverTimestamp(),
    displayName,
    photoURL,
  });

  return groupRef.id;
};

export const getGroup = async (groupId) => {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.deleted) return null;
  return { id: snap.id, ...data };
};

export const listGroups = async () => {
  const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(g => !g.deleted);
};

export const getMember = async (groupId, userId) => {
  const snap = await getDoc(doc(db, 'groups', groupId, 'members', userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const joinGroup = async (groupId, userId) => {
  const memberRef = doc(db, 'groups', groupId, 'members', userId);
  let displayName = 'User';
  let photoURL = '';
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) {
      const u = userSnap.data();
      displayName = u.displayName || u.email || 'User';
      photoURL = u.photoURL || '';
    }
  } catch { /* ignore */ }
  await setDoc(memberRef, {
    userId,
    role: 'member',
    joinedAt: serverTimestamp(),
    displayName,
    photoURL,
  });
  await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(1) });
};

export const leaveGroup = async (groupId, userId) => {
  await deleteDoc(doc(db, 'groups', groupId, 'members', userId));
  await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) });
};

export const setMemberRole = async (groupId, userId, role) => {
  await updateDoc(doc(db, 'groups', groupId, 'members', userId), { role });
};

export const listMembers = async (groupId) => {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const createGroupPost = async (groupId, user, { content, imageFile = null, type = 'post', campaignId = null }) => {
  // Determine status based on member role (admins/mods auto-approve)
  let status = 'pending';
  try {
    const memSnap = await getDoc(doc(db, 'groups', groupId, 'members', user.uid));
    const role = memSnap.exists() ? memSnap.data().role : 'member';
    if (role === 'admin' || role === 'moderator') status = 'approved';
  } catch { /* default pending */ }

  const postData = {
    type, // 'post' | 'campaign'
    campaignId: campaignId || null,
    content: content || '',
    authorId: user.uid,
    authorName: user.displayName || user.email || 'User',
    authorPhoto: user.photoURL || '',
    imageUrl: '',
    createdAt: serverTimestamp(),
    status, // 'pending' | 'approved'
  };
  const postRef = await addDoc(collection(db, 'groups', groupId, 'posts'), postData);
  if (imageFile && type === 'post') {
    const imgRef = ref(storage, `groups/${groupId}/posts/${postRef.id}_${Date.now()}`);
    await uploadBytes(imgRef, imageFile);
    const url = await getDownloadURL(imgRef);
    await updateDoc(postRef, { imageUrl: url });
  }
  return postRef.id;
};

export const listGroupPosts = async (groupId) => {
  const q = query(collection(db, 'groups', groupId, 'posts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== 'pending');
};

export const listPendingGroupPosts = async (groupId) => {
  const q = query(collection(db, 'groups', groupId, 'posts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status === 'pending');
};

export const approveGroupPost = async (groupId, postId, approverId) => {
  await updateDoc(doc(db, 'groups', groupId, 'posts', postId), {
    status: 'approved',
    approvedBy: approverId,
    approvedAt: serverTimestamp(),
  });
};

export const rejectGroupPost = async (groupId, postId) => {
  await deleteDoc(doc(db, 'groups', groupId, 'posts', postId));
};

export const updateGroup = async (groupId, { name, description, bannerFile }) => {
  const updates = {};
  if (typeof name === 'string') updates.name = name;
  if (typeof description === 'string') updates.description = description;
  if (bannerFile) {
    const bannerRef = ref(storage, `groups/${groupId}/banner_${Date.now()}`);
    await uploadBytes(bannerRef, bannerFile);
    const url = await getDownloadURL(bannerRef);
    updates.bannerUrl = url;
  }
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'groups', groupId), updates);
  }
  return true;
};

export const softDeleteGroup = async (groupId) => {
  await updateDoc(doc(db, 'groups', groupId), { deleted: true });
};
