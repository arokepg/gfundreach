# Cloud Functions for Donation Credits and Completion Notifications

This project uses a client-only app with strict Firestore rules. To safely credit recipients when donations are created (and to keep wallet balances in sync), deploy a minimal Firebase Cloud Function.

## What the function does

- Trigger on new `transactions` documents with `type = 'donation'`.
- Atomically credit the recipient's `users/{uid}` document:
  - `walletBalance += amount`
  - `totalReceived += amount`
- Optionally increment donor's `totalHelped` and recipient's `helpersCount` (derived metrics).
- Optionally set a `completedAt` field on `posts/{postId}` when `currentAmount >= goalAmount`.

## Function code (Node.js, JavaScript)

Create `functions/index.js` with:

```js
const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.onDonationCreate = functions.firestore.onDocumentCreated('transactions/{txId}', async (event) => {
  const data = event.data?.data();
  if (!data || data.type !== 'donation') return;
  const { amount = 0, recipientId, donorId, postId } = data;
  if (!recipientId || !donorId || !postId || !amount) return;

  const recipientRef = db.doc(`users/${recipientId}`);
  const donorRef = db.doc(`users/${donorId}`);
  const postRef = db.doc(`posts/${postId}`);

  await db.runTransaction(async (tx) => {
    const [recipientSnap, donorSnap, postSnap] = await Promise.all([
      tx.get(recipientRef),
      tx.get(donorRef),
      tx.get(postRef),
    ]);

    if (recipientSnap.exists) {
      const r = recipientSnap.data() || {};
      tx.update(recipientRef, {
        walletBalance: (r.walletBalance || 0) + amount,
        totalReceived: (r.totalReceived || 0) + amount,
      });
    }

    if (donorSnap.exists) {
      const d = donorSnap.data() || {};
      tx.update(donorRef, {
        totalHelped: (d.totalHelped || 0) + 1,
      });
    }

    if (postSnap.exists) {
      const p = postSnap.data() || {};
      const current = p.currentAmount || 0;
      const goal = p.goalAmount || Infinity;
      if (!p.completedAt && current >= goal) {
        tx.update(postRef, { completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  });
});
```

## Setup

1. Install tools and initialize functions

```bash
npm install -g firebase-tools
firebase login
firebase init functions  # choose JavaScript, use existing project
```

2. Replace `functions/index.js` with the code above and deploy:

```bash
firebase deploy --only functions:onDonationCreate
```

3. Security rules

No rule changes are required; the function runs with admin privileges.

## Notes

- The Wallet page now calculates totals from transactions, but the function ensures `users/*` balances reflect received donations so users can spend received funds immediately.
- If you later add refunds or chargebacks, add mirrored logic to decrement balances.
