# Firebase Setup Guide for GFundReach

This guide covers the complete Firebase/Firestore configuration needed for your crowdfunding platform with campaigns, community posts, groups, and saved items.

---

## Table of Contents
1. [Firestore Database Structure](#firestore-database-structure)
2. [Security Rules](#security-rules)
3. [Composite Indexes](#composite-indexes)
4. [Storage Rules](#storage-rules)
5. [Testing Your Setup](#testing-your-setup)
6. [Troubleshooting](#troubleshooting)

---

## Firestore Database Structure

### Overview of Collections

Your app uses these main collections:

```
posts/                           # Individual campaigns
├── {campaignId}/
│   ├── updates/                 # Community posts for each campaign
│   │   └── {updateId}
│   
groups/                          # Facebook-like groups
├── {groupId}/
│   ├── members/                 # Group membership
│   │   └── {userId}
│   └── posts/                   # Group posts and campaign shares
│       └── {postId}

users/                           # User profiles

savedItems/                      # User bookmarks

collections/                     # User-defined bookmark collections

notifications/                   # User notifications
```

---

## Security Rules

### Complete Firestore Security Rules

Go to **Firebase Console → Firestore Database → Rules** and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if true; // Public profiles
      allow create: if isOwner(userId);
      allow update, delete: if isOwner(userId);
    }
    
    // Posts (Campaigns) collection
    match /posts/{postId} {
      allow read: if true; // Everyone can view campaigns
      allow create: if isSignedIn();
      allow update: if isSignedIn() && (
        request.auth.uid == resource.data.authorId || 
        request.auth.uid == resource.data.userId
      );
      allow delete: if isSignedIn() && (
        request.auth.uid == resource.data.authorId || 
        request.auth.uid == resource.data.userId
      );
      
      // Community posts (updates) subcollection
      match /updates/{updateId} {
        allow read: if true; // Everyone can view community posts
        allow create: if isSignedIn(); // Any logged-in user can comment
        allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;
      }
    }
    
    // Helper for group roles
    function userRole(groupId) {
      return get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role;
    }

    // Groups collection
    match /groups/{groupId} {
      allow read: if true; // Everyone can discover groups
      allow create: if isSignedIn();
      // Only group owner (or admin) can update top-level group info
      allow update: if isSignedIn() && (
        request.auth.uid == resource.data.ownerId || userRole(groupId) == 'admin'
      );
      // Soft delete is represented by a 'deleted: true' flag; restrict to owner/admin
      allow delete: if isSignedIn() && (
        request.auth.uid == resource.data.ownerId || userRole(groupId) == 'admin'
      );
      
      // Group members subcollection
      match /members/{memberId} {
        allow read: if true; // Anyone can see group members
        allow create: if isSignedIn();
        // Only admins can change roles; members can update their own record minimally
        allow update: if isSignedIn() && (
          userRole(groupId) == 'admin' || request.auth.uid == memberId
        );
        allow delete: if isSignedIn() && (
          request.auth.uid == memberId || userRole(groupId) == 'admin' || request.auth.uid == get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId
        );
      }
      
      // Group posts subcollection
      match /posts/{postId} {
        allow read: if true; // Everyone can view group posts
        // Any member can create; posts from non-admins/mods should be created with status='pending'
        allow create: if isSignedIn() && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
        // Authors can edit their own content; admins/mods can approve by setting status
        allow update: if isSignedIn() && (
          request.auth.uid == resource.data.authorId || userRole(groupId) in ['admin', 'moderator']
        );
        allow delete: if isSignedIn() && (
          request.auth.uid == resource.data.authorId || userRole(groupId) in ['admin']
        );
      }
    }
    
    // Saved items collection
    match /savedItems/{itemId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.userId;
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.userId;
    }
    
    // Collections (bookmark collections)
    match /collections/{collectionId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.userId;
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.userId;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      // recipientId is the user who should receive the notification
      allow read: if isSignedIn() && request.auth.uid == resource.data.recipientId;
      allow create: if isSignedIn();
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.recipientId;
    }
  }
}
```

### Key Points About These Rules

1. **Public Reading**: Campaigns, community posts, groups, and group posts are publicly readable for discovery
2. **Authenticated Writing**: Only logged-in users can create content
3. **Owner Control**: Users can only edit/delete their own content
4. **Group Membership**: Only group members can post in groups
5. **Privacy**: Saved items and notifications are private to each user

---

## Composite Indexes

### Required Indexes for Collection Group Queries

Your app uses `collectionGroup` queries which require composite indexes. Create these indexes:

#### Option A: Automatic Creation (Recommended)

1. Run your app: `npm run dev`
2. Navigate to the home page
3. Open browser console (F12)
4. Look for errors like: `"The query requires an index..."`
5. Click the provided link in the error message
6. Firebase Console will open with pre-filled index settings
7. Click **Create Index** and wait 2-5 minutes

#### Option B: Manual Creation

Go to **Firebase Console → Firestore Database → Indexes → Composite**

Create these indexes:

**Index 1: Campaign Updates**
- Collection ID: `updates` (Collection group)
- Fields indexed:
  - `authorId` - Ascending
  - `createdAt` - Descending
- Query scope: Collection group

**Index 2: Group Posts**
- Collection ID: `posts` (Collection group)  
- Fields indexed:
  - `authorId` - Ascending
  - `createdAt` - Descending
- Query scope: Collection group

**Index 3: Saved Items by User**
- Collection ID: `savedItems`
- Fields indexed:
  - `userId` - Ascending
  - `savedAt` - Descending
- Query scope: Collection

**Index 4: Notifications by User**
- Collection ID: `notifications`
- Fields indexed:
  - `recipientId` - Ascending
  - `createdAt` - Descending
- Query scope: Collection

### Index Build Time

- Indexes typically take 2-10 minutes to build
- You can check status in Firebase Console → Indexes tab
- "Building" status will change to "Enabled" when ready

---

## Storage Rules

Your app uploads images for campaigns, community posts, and groups. Configure Storage rules:

Go to **Firebase Console → Storage → Rules** and replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper function
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Campaign images
    match /campaigns/{campaignId}/{allPaths=**} {
      allow read: if true; // Public read
      allow write: if isSignedIn(); // Only authenticated users can upload
    }
    
    // Community post images
    match /community-posts/{campaignId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn();
    }
    
    // Group images (banners and post images)
    match /groups/{groupId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn();
    }
    
    // Profile pictures
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == userId;
    }
  }
}
```

---

## Testing Your Setup

### 1. Test Campaign Creation

```javascript
// In browser console after logging in
const testCampaign = {
  title: "Test Campaign",
  description: "This is a test campaign",
  goalAmount: 1000,
  currentAmount: 0,
  category: "Education",
  imageUrl: "",
  authorId: firebase.auth().currentUser.uid,
  authorName: firebase.auth().currentUser.displayName,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

firebase.firestore().collection('posts').add(testCampaign)
  .then(doc => console.log("Campaign created:", doc.id))
  .catch(err => console.error("Error:", err));
```

### 2. Test Community Post Creation

```javascript
// Replace CAMPAIGN_ID with an actual campaign ID
const campaignId = "CAMPAIGN_ID";
const testUpdate = {
  content: "Test community post",
  authorId: firebase.auth().currentUser.uid,
  authorName: firebase.auth().currentUser.displayName,
  authorPhoto: firebase.auth().currentUser.photoURL || "",
  campaignTitle: "Test Campaign",
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

firebase.firestore()
  .collection('posts').doc(campaignId)
  .collection('updates').add(testUpdate)
  .then(doc => console.log("Community post created:", doc.id))
  .catch(err => console.error("Error:", err));
```

### 3. Test Group Creation

```javascript
const testGroup = {
  name: "Test Group",
  description: "This is a test group",
  ownerId: firebase.auth().currentUser.uid,
  memberCount: 1,
  postCount: 0,
  bannerUrl: "",
  privacy: "public",
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

firebase.firestore().collection('groups').add(testGroup)
  .then(async (doc) => {
    console.log("Group created:", doc.id);
    // Add owner as admin member
    await firebase.firestore()
      .collection('groups').doc(doc.id)
      .collection('members').doc(firebase.auth().currentUser.uid)
      .set({
        userId: firebase.auth().currentUser.uid,
        role: 'admin',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    console.log("Owner added as admin");
  })
  .catch(err => console.error("Error:", err));
```

### 4. Test Group Post Creation

```javascript
// Replace GROUP_ID with an actual group ID
const groupId = "GROUP_ID";
const testGroupPost = {
  type: "post", // or "campaign" for campaign shares
  campaignId: null, // Set to campaign ID if type is "campaign"
  content: "Test group post",
  authorId: firebase.auth().currentUser.uid,
  authorName: firebase.auth().currentUser.displayName,
  authorPhoto: firebase.auth().currentUser.photoURL || "",
  imageUrl: "",
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

firebase.firestore()
  .collection('groups').doc(groupId)
  .collection('posts').add(testGroupPost)
  .then(doc => console.log("Group post created:", doc.id))
  .catch(err => console.error("Error:", err));
```

---

## Troubleshooting

### Issue: "No posts found" on home page

**Possible causes:**
1. No data exists in Firestore
2. Security rules are blocking reads
3. Missing composite indexes
4. Collection group queries failing

**Solutions:**
1. Use the test scripts above to create sample data
2. Verify security rules allow public reads for posts, updates, and groups
3. Create the composite indexes listed above
4. Check browser console for specific error messages

### Issue: "Permission denied" errors

**Possible causes:**
1. Security rules too restrictive
2. User not authenticated
3. User not a member of the group

**Solutions:**
1. Verify you're logged in: `firebase.auth().currentUser`
2. Check that security rules match the examples above
3. For group posts, ensure user is added to `groups/{groupId}/members`

### Issue: Collection group queries return empty

**Possible causes:**
1. Composite indexes not yet built (status: Building)
2. No matching documents exist
3. Security rules block reads

**Solutions:**
1. Wait 2-10 minutes for indexes to finish building
2. Create test documents using scripts above
3. Temporarily make rules more permissive to test:
   ```javascript
   match /{document=**} {
     allow read, write: if true; // TEMPORARY TESTING ONLY!
   }
   ```

### Issue: Images not uploading

**Possible causes:**
1. Storage rules too restrictive
2. Incorrect storage paths
3. File size too large (default limit: 5MB)

**Solutions:**
1. Verify Storage rules match the examples above
2. Check paths in your upload code match Storage rules
3. Resize images before upload or increase Storage limits

### Issue: Indexes taking too long

**Normal behavior:**
- Small datasets (< 1000 docs): 2-5 minutes
- Medium datasets (1000-10000 docs): 5-15 minutes
- Large datasets (> 10000 docs): 15-60 minutes

**If stuck "Building" for > 1 hour:**
1. Delete the index
2. Wait 5 minutes
3. Recreate it
4. Check Firebase Status page for service issues

---

## Quick Start Checklist

Use this checklist to set up Firebase from scratch:

- [ ] Copy and apply Firestore Security Rules
- [ ] Copy and apply Storage Rules
- [ ] Run `npm run dev` and visit home page
- [ ] Click index creation links in browser console errors
- [ ] Wait for indexes to build (check Firebase Console → Indexes)
- [ ] Create test campaign using test script
- [ ] Create test community post using test script
- [ ] Create test group using test script
- [ ] Create test group post using test script
- [ ] Verify all items appear on home page
- [ ] Test like, share, and save functionality
- [ ] Test creating posts as different users

---

## Support

If you encounter issues not covered here:

1. Check browser console for specific error messages
2. Check Firebase Console → Firestore → Rules for rule evaluation errors
3. Check Firebase Console → Indexes for index build status
4. Verify document structure matches expected format
5. Test with simpler security rules temporarily (see Troubleshooting)

---

## Data Structure Reference

### Campaign Document (posts/{id})
```javascript
{
  title: string,
  description: string,
  summary: string,
  category: string,
  goalAmount: number,
  currentAmount: number,
  imageUrl: string,
  authorId: string,
  authorName: string,
  authorPhoto: string,
  userId: string,
  displayName: string,
  location: string,
  priority: "high" | "medium" | "low",
  likedBy: [userId1, userId2, ...],
  likesCount: number,
  sharesCount: number,
  updateCount: number,
  createdAt: Timestamp,
  lastUpdateAt: Timestamp,
  lastUpdatePreview: string
}
```

### Community Post Document (posts/{campaignId}/updates/{id})
```javascript
{
  content: string,
  imageUrl: string,
  authorId: string,
  authorName: string,
  authorPhoto: string,
  campaignTitle: string,
  likedBy: [userId1, userId2, ...],
  likesCount: number,
  sharesCount: number,
  createdAt: Timestamp,
  updatedAt: Timestamp (optional)
}
```

### Group Document (groups/{id})
```javascript
{
  name: string,
  description: string,
  ownerId: string,
  bannerUrl: string,
  memberCount: number,
  postCount: number,
  privacy: "public" | "private",
  createdAt: Timestamp
}
```

### Group Member Document (groups/{groupId}/members/{userId})
```javascript
{
  userId: string,
  role: "admin" | "moderator" | "member",
  joinedAt: Timestamp
}
```

### Group Post Document (groups/{groupId}/posts/{id})
```javascript
{
  type: "post" | "campaign",
  content: string,
  imageUrl: string,
  campaignId: string (if type === "campaign"),
  authorId: string,
  authorName: string,
  authorPhoto: string,
  likedBy: [userId1, userId2, ...],
  likesCount: number,
  sharesCount: number,
  createdAt: Timestamp
}
```

### Saved Item Document (savedItems/{id})
```javascript
{
  userId: string,
  itemId: string,
  itemType: "post" | "campaign",
  title: string,
  description: string,
  imageUrl: string,
  authorId: string,
  authorName: string,
  campaignId: string (optional, for community posts),
  groupId: string (optional, for group posts),
  collections: [collectionId1, collectionId2, ...],
  savedAt: Timestamp
}
```

---

**Last Updated:** October 24, 2025  
**Version:** 1.0
