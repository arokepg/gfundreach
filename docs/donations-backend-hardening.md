# Donations Backend Hardening: Reliable Recipient Credits and Safe Clients

This tutorial makes your donation flow resilient and secure by moving critical balance and totals updates to the backend (Cloud Functions). Your client UI stays snappy with optimistic updates, but the backend becomes the source of truth so recipients always get credited.

## Why harden the backend?

- Security: Clients should not be able to freely edit other users' balances or campaign totals.
- Reliability: Network glitches or client retries shouldn’t cause double-charges or missed credits.
- Observability: Centralized, auditable donation processing makes debugging easier.

## Overview

We’ll implement a Firestore trigger that processes new donation transactions:

- On create of `transactions/{id}` where `type == 'donation'`:
  - Idempotently set `processedAt` on the transaction (ensuring single processing per donation).
  - Increment recipient's `walletBalance` and `totalReceived`.
  - Increment donor's `totalDonated` (if you don't already in UI).
  - Increment campaign’s `currentAmount` and `supporters` (if you want server as source of truth).

We’ll also cover testing with Emulators and client changes to avoid race conditions.

## Data model assumptions

- Collection: `transactions`
  - Example donation doc fields:
    - `type: 'donation'`
    - `amount: number`
    - `postId: string` (campaign id)
    - `postTitle: string`
    - `donorId: string`
    - `recipientId: string`
    - `createdAt: timestamp/string`
    - Optional: `processedAt: timestamp` (set by backend)
- Collection: `posts/{postId}` (campaign)
- Collection: `users/{userId}` with fields `walletBalance`, `totalDonated`, `totalReceived`

## Firestore Security rules (essentials)

- Clients can create donation transactions only for themselves (donorId == auth.uid).
- Clients should NOT update other users’ documents or other campaigns directly.

Example snippet:

```rules
match /transactions/{txId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.type == 'donation'
    && request.resource.data.donorId == request.auth.uid;
}
```

See your `FIRESTORE_RULES.md` for your full ruleset.

## Cloud Functions: donation processor

Create a function that triggers when a donation transaction is created and applies all authoritative updates in a single batch.

```js
// functions/index.js (ESM)
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export const onDonationCreated = onDocumentCreated('transactions/{id}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const tx = snap.data();

  try {
    if (tx.type !== 'donation') return;
    // Idempotency: if already processed (has processedAt), skip
    if (tx.processedAt) return;

    const amount = Number(tx.amount) || 0;
    if (amount <= 0) return;

    const batch = db.batch();

    // Mark processed
    const txRef = db.collection('transactions').doc(snap.id);
    batch.update(txRef, { processedAt: FieldValue.serverTimestamp() });

    // Recipient: credit wallet and total received
    if (tx.recipientId) {
      batch.update(db.collection('users').doc(tx.recipientId), {
        walletBalance: FieldValue.increment(amount),
        totalReceived: FieldValue.increment(amount),
      });
    }

    // Donor: accumulate total donated (idempotent per tx)
    if (tx.donorId) {
      batch.update(db.collection('users').doc(tx.donorId), {
        totalDonated: FieldValue.increment(amount),
      });
    }

    // Campaign: update totals (server as source of truth)
    if (tx.postId) {
      batch.update(db.collection('posts').doc(tx.postId), {
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

### Common pitfalls

- Missing index or rules for reading users/posts from the function: Cloud Functions Admin SDK bypasses rules, so this is not an issue in the function.
- Duplicates: The `processedAt` flag prevents double-processing on retries.
- Negative/NaN: Always coerce and validate `amount` >= 0.

## Client changes for smooth UX

- Keep your current optimistic UI (show success immediately once transaction write succeeds).
- Do NOT block on any secondary updates (recipient user doc, post totals). The function will catch up.
- Optionally, show a small sync indicator if the donation data is pending backend confirmation.

## Testing with Firebase Emulator Suite

1. Install and start emulators
   ```bash
   firebase emulators:start --only firestore,functions
   ```
2. Point your local app to the emulator (if not already configured).
3. Create a test donation via UI; verify:
   - A new `transactions` doc is created.
   - The function sets `processedAt`.
   - The recipient’s `walletBalance` and `totalReceived` increased.
   - The donor’s `totalDonated` increased.
   - The campaign’s `currentAmount` and `supporters` increased.

## Deployment

- Deploy the function only:
  ```bash
  firebase deploy --only functions:onDonationCreated
  ```
- Watch logs for errors (in Firebase console or `firebase functions:log`).

## Rollout strategy

- Keep current client best-effort updates during rollout; after verifying the function, you may simplify client code:
  - Either remove client writes to recipient and post totals, or keep them for optimistic UX (function is authoritative and covers gaps).
- Add a one-off backfill function to reprocess historical donations that lack `processedAt`.
  - Iterate `transactions` where `type == 'donation' && !processedAt` and apply the same logic.

## Troubleshooting

- Recipient not credited:
  - Check if `processedAt` is set on the transaction; if not, inspect function logs.
- Double credits:
  - Ensure `processedAt` is written before batch commit completes; this sample writes it in the same batch.
- Permission denied on client writes:
  - Clients should only create `transactions` docs. All cross-user updates are done in the function.

## Optional enhancements

- Send notifications:
  - Fire another function on donation to notify the recipient and a receipt notification to the donor.
- Webhooks / external payments:
  - If using Stripe, handle the donation creation from the webhook event and write the `transactions` doc yourself; the same function will process it.
- Analytics:
  - Stream donation events into BigQuery for dashboards.

---

With this backend trigger in place, your donation system becomes reliable and secure, while the UI remains fast and user-friendly.
