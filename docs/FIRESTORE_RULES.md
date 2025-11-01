rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // NOTE: This project stores images as base64 data URLs inside Firestore documents
    // (no Firebase Storage). Fields like imageUrl or bannerUrl will be data URLs
    // starting with "data:image/...". It's recommended to also store a numeric
    // field imageSizeKB to enforce size limits in rules.
    // Example constraint idea (pseudocode in comments):
    // allow create, update: if request.resource.data.imageUrl.matches('^data:image/')
    //   && request.resource.data.imageSizeKB <= 500

    // Helpers
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    function listSize(l) {
      return l == null ? 0 : l.size();
    }
    function isValidLikeToggle() {
      return (
        !("likedBy" in request.resource.data)
        || (
          request.resource.data.likedBy.size() == listSize(resource.data.likedBy) + 1 &&
          request.resource.data.likedBy.hasAll(resource.data.likedBy) &&
          request.resource.data.likedBy.hasAny([request.auth.uid])
        )
        || (
          listSize(resource.data.likedBy) == request.resource.data.likedBy.size() + 1 &&
          resource.data.likedBy.hasAll(request.resource.data.likedBy) &&
          resource.data.likedBy.hasAny([request.auth.uid])
        )
      );
    }
    function isGroupAdminOrMod(groupId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role in ['admin', 'moderator'];
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(userId);
    }

    // Campaign posts
    match /posts/{postId} {
      allow read: if true;
      allow create: if isSignedIn();
      // Owner can update/delete their campaign
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;

      // Group admins/moderators can manage campaigns that belong to their group
      allow update, delete: if isSignedIn() && resource.data.groupId != null && isGroupAdminOrMod(resource.data.groupId);

      // Public increments for donation and reactions only
      allow update: if isSignedIn() &&
        request.resource.data.diff(resource.data).changedKeys().hasOnly(["currentAmount","supporters","likesCount","sharesCount","likedBy","lastUpdateAt","lastUpdatePreview","updateCount"]);

      // Image fields stored as base64 in Firestore
      // Optional: If you store imageSizeKB numeric fields, constrain them here
      // allow create, update: if (!('imageSizeKB' in request.resource.data) || request.resource.data.imageSizeKB <= 500);

      // Community updates subcollection
      match /updates/{updateId} {
        allow read: if true;
        allow create: if isSignedIn();
        allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;
        // Public reaction counters
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }
    }

    // Transactions (donations/topups/withdrawals)
    match /transactions/{txId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.donorId == request.auth.uid &&
        request.resource.data.type in ['donation', 'topup', 'withdraw'];
    }

    // Saved items (bookmarks)
    match /savedItems/{sid} {
      // Doc ID convention: `${userId}_${itemId}`
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
    }

    // Collections (user-defined lists)
    match /collections/{cid} {
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }

    // Notifications
    match /notifications/{nid} {
      allow read, update, delete: if isSignedIn() && resource.data.recipientId == request.auth.uid;
      allow create: if isSignedIn();
    }

    // Friendships (symmetric friend system)
    match /friendships/{friendshipId} {
      allow read: if isSignedIn() && request.auth.uid in resource.data.users;
      allow create: if isSignedIn() && request.auth.uid in request.resource.data.users;
      allow update, delete: if isSignedIn() && request.auth.uid in resource.data.users;
    }

    // Groups
    match /groups/{groupId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.ownerId;

      // Group posts
      match /posts/{postId} {
        allow read: if true;
        allow create: if isSignedIn();
        allow update, delete: if isSignedIn() && (request.auth.uid == resource.data.authorId || isGroupAdminOrMod(groupId));
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }

      // Members
      match /members/{uid} {
        allow read: if isSignedIn();
        allow create: if isSignedIn() && request.auth.uid == uid;
        allow delete: if isSignedIn() && (request.auth.uid == uid || isGroupAdminOrMod(groupId));
        allow update: if isSignedIn() && isGroupAdminOrMod(groupId);
      }
    }
  }
}
