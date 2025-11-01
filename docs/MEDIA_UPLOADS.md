# Media Uploads (Images) – Setup & Troubleshooting

This app supports uploading images for:
- Campaign cover images
- Group banner images
- Community post images

Uploads go to Firebase Storage and fall back to base64 (Firestore) only if Storage is unavailable. Follow these steps to ensure uploads work reliably in dev and production.

## 1) Enable Firebase Storage and set the correct bucket

In your Firebase project:
- Go to Build → Storage → Get started → Create a default bucket.
- Your default bucket name is usually `<project-id>.appspot.com`.

Set environment variables for Vite (e.g., `.env.local`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=gfundreach
VITE_FIREBASE_STORAGE_BUCKET=gfundreach.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Note: The bucket must end with `appspot.com`. Using `firebasestorage.app` here will break the SDK.

## 2) Storage security rules

Start with a simple authenticated rule set while you iterate:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read;                      // public read (adjust if needed)
      allow write: if request.auth != null; // only signed-in users can upload
    }
  }
}
```

Harden later as needed (e.g., per path, size/type checks).

## 3) Image compression and retry

- All campaign and group uploads are compressed on the client to keep images fast and cheap to serve.
- Uploads use resumable uploads with retry logic; on repeated failures, the app falls back to base64 storage (as a last resort).

Relevant helpers:
- `src/utils/imageUtils.js` – compression pipeline
- `src/utils/uploadHelpers.js` – resumable upload + retry
- `src/utils/base64Upload.js` – base64 fallback

## 4) Common errors and fixes

- "storage/unauthorized" → Update your Storage rules to allow authenticated writes.
- "storage/invalid-argument" → Ensure your bucket is `<project-id>.appspot.com`.
- CORS or mixed content → Always serve over HTTPS in production; Vercel handles this by default.
- Very large images → Compression already runs, but 10–20MP images can still be slow to process. Prefer under 10MB originals when possible.

## 5) Local testing

- Ensure `.env.local` exists with the variables above.
- Restart the dev server after changing env vars.

If uploads still fail, check the browser console for logs from the upload helpers and share the exact error message.
