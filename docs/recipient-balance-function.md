# Auto-credit recipient wallet on donations (Cloud Functions)

This backend function fixes the persistent issue where a recipient's `walletBalance` and `totalReceived` are not updated when their campaign receives a donation initiated by someone else.

Front-end clients should not have permission to write to other users' documents. Instead, a secure backend trigger will update the recipient reliably.

## What it does

- Listens to new documents in the `transactions` collection where `type === 'donation'`.
- Atomically updates:
  - Recipient: `walletBalance += amount`, `totalReceived += amount`
  - Donor: optionally ensure `totalDonated += amount` (idempotent, if not updated elsewhere)
  - Post: `currentAmount += amount`, `supporters += 1` (if you want the source of truth here too)
- Idempotency: guards against re-processing by writing a `processedAt` timestamp to the transaction.

## Firebase Functions v2 (Node.js 18+) sample

Create a new Firebase Functions project (or add to your existing one) and deploy the following:

```js
// functions/index.js
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
const db = getFirestore();

export const onDonationCreated = onDocumentCreated('transactions/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const tx = snap.data();

  try {
    if (tx.type !== 'donation') return;
    // Idempotency: skip if already processed
    if (tx.processedAt) return;

    const amount = Number(tx.amount) || 0;
    if (amount <= 0) return;

    const batch = db.batch();

    const txRef = db.collection('transactions').doc(snap.id);
    batch.update(txRef, { processedAt: FieldValue.serverTimestamp() });

    if (tx.recipientId) {
      const recipientRef = db.collection('users').doc(tx.recipientId);
      batch.update(recipientRef, {
        walletBalance: FieldValue.increment(amount),
        totalReceived: FieldValue.increment(amount),
      });
    }

    if (tx.donorId) {
      const donorRef = db.collection('users').doc(tx.donorId);
      batch.update(donorRef, {
        totalDonated: FieldValue.increment(amount),
      });
    }

    if (tx.postId) {
      const postRef = db.collection('posts').doc(tx.postId);
      batch.update(postRef, {
        currentAmount: FieldValue.increment(amount),
        supporters: FieldValue.increment(1),
      });
    }

    await batch.commit();
  } catch (err) {
    console.error('onDonationCreated failed:', err);
  }
});
```

## Deploy

```bash
firebase deploy --only functions:onDonationCreated
```

## Notes

- Keep the client-side updates for optimistic UX, but treat this function as the source of truth.
- If you already increment `currentAmount` and `supporters` on the client, you can remove that part from the function or keep it for consistency (double-increment is prevented by only running one of them).
- Consider adding a second function to reconcile historical transactions if some predate this trigger.
