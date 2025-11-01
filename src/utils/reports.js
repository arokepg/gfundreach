import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Create a moderation report document.
 * @param {Object} params
 * @param {'campaign'|'community_post'|'group_post'} params.targetType
 * @param {string} params.targetId - The ID of the content being reported
 * @param {string} params.reportedById - UID of the reporter
 * @param {string} [params.reportedByName] - Optional display name of the reporter
 * @param {string} [params.reason] - Short reason/category
 * @param {string} [params.comment] - Optional free-text details
 * @param {Object} [params.meta] - Extra context like campaignId, groupId, authorId
 */
export async function reportContent({ targetType, targetId, reportedById, reportedByName = '', reason = 'other', comment = '', meta = {} }) {
  if (!targetType || !targetId || !reportedById) throw new Error('Missing required report fields');
  const payload = {
    targetType,
    targetId,
    reportedById,
    reportedByName,
    reason,
    comment,
    meta: meta || {},
    status: 'open',
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'reports'), payload);
  return true;
}

export default reportContent;
