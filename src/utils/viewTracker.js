import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
  const visitorKey = currentUser?.uid || vid; // person-level when logged-in

  // Throttle guard to avoid immediate double-counts from React strict-mode double effects in dev
  // Allows true additional views after a short interval
  const throttleKey = `gfr_last_view_ts:${postId}`;
  try {
    const last = Number(sessionStorage.getItem(throttleKey) || '0');
    const now = Date.now();
    if (last && now - last < 1500) {
      // Too soon since last view in this tab; skip counting this as a separate view
      return;
    }
    sessionStorage.setItem(throttleKey, String(now));
  } catch {
    // ignore sessionStorage errors
  }

  // Unique visitors: one doc per person (uid) or per device (vid) if anonymous
  const visitorRef = doc(db, 'posts', postId, 'visitors', visitorKey);

  try {
    // Always record a view event (one document per view)
    await addDoc(collection(db, 'posts', postId, 'views'), {
      visitorId: vid,
      visitorKey,
      userId: currentUser?.uid || null,
      dateKey,
      createdAt: serverTimestamp(),
    });

    // For unique visitor counting, update/merge a single doc keyed by visitorKey
    await setDoc(visitorRef, {
      // Preserve both ids for analysis
      visitorId: vid,
      userId: currentUser?.uid || null,
      keyType: currentUser?.uid ? 'user' : 'device',
      lastViewedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    // Help surface rule or network errors without breaking UX
    console.warn('recordCampaignView failed:', e?.message || e);
  } finally {
    // no-op
  }
};
