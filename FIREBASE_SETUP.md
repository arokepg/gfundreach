# Firebase Setup Guide for Gfundreach

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `gfundreach`
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, click "Authentication" in the left menu
2. Click "Get started"
3. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"
4. Enable **Google Sign-In**:
   - Click on "Google"
   - Toggle "Enable"
   - Select support email
   - Click "Save"

## Step 3: Create Firestore Database

1. Click "Firestore Database" in the left menu
2. Click "Create database"
3. Select "Start in test mode" (we'll add rules later)
4. Choose your location (closest to your users)
5. Click "Enable"

## Step 4: Setup Firestore Security Rules

1. Go to Firestore Database → Rules
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Posts collection
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
    
    // Transactions collection
    match /transactions/{transactionId} {
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.donorId || 
         request.auth.uid == resource.data.recipientId);
      allow create: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

## Step 5: Enable Storage (OPTIONAL - Requires Blaze Plan)

**Note:** Firebase Storage requires the Blaze (pay-as-you-go) plan. If you want to avoid costs, skip this step and use external image URLs instead (e.g., Imgur, Cloudinary free tier).

If you want to enable Storage:
1. Click "Storage" in the left menu
2. Click "Get started"
3. Choose "Start in test mode"
4. Click "Next"
5. Select location
6. Click "Done"
7. Go to Storage → Rules and add security rules

**Alternative:** Configure the app to use external image URLs (no Firebase Storage needed).

## Step 6: Get Firebase Configuration

1. In Project Settings (gear icon) → General
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register app with nickname: `gfundreach-web`
5. Copy the configuration object
6. Update `src/config/firebase.js` with your config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 7: Create Firestore Indexes (Optional but Recommended)

For better query performance, create these composite indexes:

1. Go to Firestore Database → Indexes
2. Add composite index for posts:
   - Collection ID: `posts`
   - Fields: `authorId` (Ascending), `createdAt` (Descending)
3. Add composite index for transactions:
   - Collection ID: `transactions`
   - Fields: `donorId` (Ascending), `createdAt` (Descending)
4. Add composite index for transactions:
   - Collection ID: `transactions`
   - Fields: `recipientId` (Ascending), `createdAt` (Descending)

## Step 8: Optional - Firebase Hosting

To deploy your app to Firebase Hosting:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project:
   ```bash
   firebase init
   ```
   - Select "Hosting"
   - Select your project
   - Set public directory: `dist`
   - Configure as SPA: Yes
   - Don't overwrite index.html

4. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

## Firestore Collections Structure

### users
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  bio: string,
  walletBalance: number,
  totalDonated: number,
  totalReceived: number,
  createdAt: string (ISO date)
}
```

### posts
```javascript
{
  title: string,
  description: string,
  category: string,
  goalAmount: number,
  currentAmount: number,
  imageUrl: string,
  authorId: string,
  authorName: string,
  authorPhoto: string,
  supporters: number,
  createdAt: string (ISO date),
  updatedAt: string (ISO date)
}
```

### transactions
```javascript
{
  type: string ("donation"),
  amount: number,
  message: string,
  postId: string,
  postTitle: string,
  donorId: string,
  donorName: string,
  recipientId: string,
  recipientName: string,
  createdAt: string (ISO date)
}
```

## Security Best Practices

1. **Never commit Firebase config** with sensitive keys to public repositories
2. **Use Firebase App Check** in production to prevent abuse
3. **Set up billing alerts** in Google Cloud Console
4. **Enable reCAPTCHA** for authentication
5. **Regularly review security rules** and access patterns
6. **Implement rate limiting** for expensive operations
7. **Use Firebase Admin SDK** on server for privileged operations

## Troubleshooting

### Authentication Issues
- Verify Email/Password and Google are enabled in Authentication
- Check that authorized domains include your app domain
- Clear browser cache and cookies

### Firestore Permission Denied
- Verify security rules are published
- Check that user is authenticated
- Use Firebase Console to test rules

### Storage Upload Fails
- Verify storage rules allow writes
- Check file size is under 10MB
- Ensure file is an image

### CORS Errors
- Add your domain to authorized domains in Firebase Console
- For localhost, it should work by default

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Support](https://firebase.google.com/support)
- [Stack Overflow - Firebase](https://stackoverflow.com/questions/tagged/firebase)
