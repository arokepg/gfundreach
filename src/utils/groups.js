import { db } from '../config/firebase';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, orderBy, increment, where } from 'firebase/firestore';
import { uploadImage } from './uploadHelpers';
import { createNotification } from './notifications';

// Create a group with name, description and optional banner file
export const createGroup = async (ownerId, { name, description = '', bannerFile = null }) => {
  let groupRef = null;
  
  try {
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

    groupRef = await addDoc(collection(db, 'groups'), groupData);

    // Upload banner if provided (compress + retry with robust helper)
    if (bannerFile) {
      try {
        const storagePath = `groups/${groupRef.id}/banner_${Date.now()}.jpg`;
        const url = await uploadImage(bannerFile, storagePath);
        await updateDoc(groupRef, { bannerUrl: url });
      } catch (uploadErr) {
        console.error('Banner upload failed, continuing without banner:', uploadErr);
        // Continue without banner rather than failing entirely
      }
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
  } catch (err) {
    // If group was created but something else failed, clean it up
    if (groupRef) {
      try {
        await deleteDoc(doc(db, 'groups', groupRef.id));
        // Try to delete the member doc too
        try {
          await deleteDoc(doc(db, 'groups', groupRef.id, 'members', ownerId));
        } catch { /* ignore */ }
      } catch (cleanupErr) {
        console.error('Failed to cleanup group after error:', cleanupErr);
      }
    }
    throw err;
  }
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
  // Best-effort notifications: to user and admins/mods
  try {
    const gSnap = await getDoc(doc(db, 'groups', groupId));
    const groupName = gSnap.data()?.name || 'Group';
    // Notify user
    await createNotification(userId, 'group_join_success', { senderId: userId, groupId, groupName });
    // Notify admins/moderators
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    const adminIds = membersSnap.docs
      .map(d => d.data())
      .filter(m => m.role === 'admin' || m.role === 'moderator')
      .map(m => m.userId)
      .filter(id => id && id !== userId);
    await Promise.allSettled(adminIds.map(adminId => createNotification(adminId, 'group_member_joined', {
      senderId: userId,
      senderName: displayName,
      groupId,
      groupName,
    })));
  } catch {/* non-fatal */}
};

export const leaveGroup = async (groupId, userId) => {
  const memberDocRef = doc(db, 'groups', groupId, 'members', userId);
  const snap = await getDoc(memberDocRef);
  if (snap.exists()) {
    await deleteDoc(memberDocRef);
  } else {
    // Legacy fallback: member doc ID may not equal userId
    try {
      const qSnap = await getDocs(query(collection(db, 'groups', groupId, 'members'), where('userId', '==', userId)));
      if (!qSnap.empty) {
        await deleteDoc(qSnap.docs[0].ref);
      }
    } catch {/* ignore */}
  }
  await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) });
  // Best-effort: notify user about successful leave
  try {
    const gSnap = await getDoc(doc(db, 'groups', groupId));
    const groupName = gSnap.data()?.name || 'Group';
    await createNotification(userId, 'group_leave_success', { senderId: userId, groupId, groupName });
  } catch {/* non-fatal */}
  
  // Check if group is now empty and delete if so
  try {
    await cleanupEmptyGroup(groupId);
  } catch {/* non-fatal */}
};

export const removeMember = async (groupId, userId) => {
  // Alias for kicking a member by an admin/moderator
  const memberDocRef = doc(db, 'groups', groupId, 'members', userId);
  const snap = await getDoc(memberDocRef);
  if (snap.exists()) {
    await deleteDoc(memberDocRef);
  } else {
    // Legacy fallback: member doc ID may not equal userId
    const qSnap = await getDocs(query(collection(db, 'groups', groupId, 'members'), where('userId', '==', userId)));
    if (!qSnap.empty) {
      await deleteDoc(qSnap.docs[0].ref);
    } else {
      // If there's nothing to delete, just return
      return true;
    }
  }
  await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) });
  // Notify the user that they were removed
  try {
    const gSnap = await getDoc(doc(db, 'groups', groupId));
    const groupName = gSnap.data()?.name || 'Group';
    await createNotification(userId, 'group_kicked', { senderId: userId, groupId, groupName });
  } catch {/* non-fatal */}
  
  // Check if group is now empty and delete if so
  try {
    await cleanupEmptyGroup(groupId);
  } catch {/* non-fatal */}
  
  return true;
};

export const setMemberRole = async (groupId, userId, role) => {
  // First try the canonical path where member doc ID == userId
  const memberRef = doc(db, 'groups', groupId, 'members', userId);
  const directSnap = await getDoc(memberRef);
  if (directSnap.exists()) {
    await updateDoc(memberRef, { role });
    return true;
  }
  // Legacy support: some groups may have member docs with random IDs and a userId field
  const colRef = collection(db, 'groups', groupId, 'members');
  const qs = query(colRef, where('userId', '==', userId));
  const qSnap = await getDocs(qs);
  if (!qSnap.empty) {
    await updateDoc(qSnap.docs[0].ref, { role });
    return true;
  }
  throw new Error('Member not found');
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
    try {
      const storagePath = `groups/${groupId}/posts/${postRef.id}_${Date.now()}.jpg`;
      const url = await uploadImage(imageFile, storagePath);
      await updateDoc(postRef, { imageUrl: url });
    } catch (e) {
      console.error('Failed to attach image to group post, continuing without image:', e);
    }
  }
  // Best-effort notifications:
  try {
    const gSnap = await getDoc(doc(db, 'groups', groupId));
    const groupName = gSnap.data()?.name || 'Group';
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    const recipients = membersSnap.docs.map(d => d.data()).filter(m => m.userId && m.userId !== user.uid);
    if (status === 'approved') {
      // Notify all members about new content
      await Promise.allSettled(recipients.map(m => createNotification(m.userId, type === 'campaign' ? 'group_campaign_created' : 'group_post_created', {
        senderId: user.uid,
        senderName: user.displayName || 'Someone',
        groupId,
        groupName,
        campaignId: campaignId || null,
      })));
    } else {
      // Pending: notify admins/mods for approval
      const adminRecipients = recipients.filter(m => m.role === 'admin' || m.role === 'moderator');
      await Promise.allSettled(adminRecipients.map(m => createNotification(m.userId, 'group_post_created', {
        senderId: user.uid,
        senderName: user.displayName || 'Someone',
        groupId,
        groupName,
      })));
    }
  } catch {/* non-fatal */}
  return postRef.id;
};

export const listGroupPosts = async (groupId) => {
  const q = query(collection(db, 'groups', groupId, 'posts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.status !== 'pending' && !p.hidden);
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
    try {
      const storagePath = `groups/${groupId}/banner_${Date.now()}.jpg`;
      const url = await uploadImage(bannerFile, storagePath);
      updates.bannerUrl = url;
    } catch (e) {
      console.error('Failed updating banner, keeping old one:', e);
    }
  }
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'groups', groupId), updates);
  }
  return true;
};

export const softDeleteGroup = async (groupId) => {
  // Actually delete the group document and all subcollections
  try {
    // Delete all members
    const membersSnapshot = await getDocs(collection(db, 'groups', groupId, 'members'));
    const memberDeletes = membersSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(memberDeletes);

    // Delete all group posts
    const postsSnapshot = await getDocs(collection(db, 'groups', groupId, 'posts'));
    const postDeletes = postsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(postDeletes);

    // Delete the group itself
    await deleteDoc(doc(db, 'groups', groupId));
  } catch (err) {
    console.error('Error deleting group:', err);
    throw err;
  }
};

// Check if group has no members and delete if empty
export const cleanupEmptyGroup = async (groupId) => {
  try {
    const membersSnapshot = await getDocs(collection(db, 'groups', groupId, 'members'));
    if (membersSnapshot.empty) {
      console.log(`Group ${groupId} has no members, deleting...`);
      await softDeleteGroup(groupId);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error checking group members:', err);
    return false;
  }
};
