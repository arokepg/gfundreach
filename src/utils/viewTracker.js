import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Simple persistent visitor id using localStorage
const VISITOR_KEY = 'gfr_visitor_id';

const uuid = () => crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const getVisitorId = () => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Fallback ephemeral id
    return uuid();
  }
};

export const getDateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`; // YYYYMMDD
};

// Record one view per visitor per day and keep a rolling visitors collection
export const recordCampaignView = async (postId, currentUser) => {
  if (!postId) return;
  const vid = getVisitorId();
  const dateKey = getDateKey();

  // Local guard to avoid duplicate writes in the same tab/day (and double effects in dev)
  const localKey = `gfr_viewed:${postId}:${dateKey}`;
  try {
    if (localStorage.getItem(localKey)) return;
  } catch (err) {
    // Ignore localStorage errors
    console.warn('localStorage unavailable:', err);
  }

  const viewDocId = `${vid}_${dateKey}`;
  const viewRef = doc(db, 'posts', postId, 'views', viewDocId);
  const visitorRef = doc(db, 'posts', postId, 'visitors', vid);

  try {
    // Best-effort writes; duplication is minimized by id scheme and local guard
    await Promise.all([
      setDoc(viewRef, {
        visitorId: vid,
        userId: currentUser?.uid || null,
        dateKey,
        createdAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(visitorRef, {
        visitorId: vid,
        userId: currentUser?.uid || null,
        lastViewedAt: serverTimestamp(),
      }, { merge: true })
    ]);
  } finally {
    try { 
      localStorage.setItem(localKey, '1'); 
    } catch (err) {
      // Ignore localStorage errors
      console.warn('localStorage unavailable:', err);
    }
  }
};
