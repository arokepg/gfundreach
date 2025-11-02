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
    // NOTE: Keep helper functions minimal to reduce syntax issues in editors.
    function isGroupAdminOrMod(groupId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role in ['admin', 'moderator'];
    }

    // Optional: Global Admin helper
    // Use Firebase Auth custom claims (request.auth.token.admin) or a role field on the user document
    function isAdmin() {
      return isSignedIn() && (
        (request.auth.token.admin == true) || (
          exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
        )
      );
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn(); // Allows user search for messaging
      allow create: if isSignedIn();
      allow update, delete: if isOwner(userId);
      
      // Note: For better search performance, consider:
      // 1. Creating a composite index on displayName (ascending) 
      // 2. Using Algolia/ElasticSearch for full-text search
      // 3. Current implementation uses prefix matching which requires: 
      //    - Index: displayName (ascending)
    }

    // Campaign posts
    match /posts/{postId} {
      allow read: if true;
      // Only the signed-in user may create a campaign with themself as the author
      allow create: if isSignedIn() && request.resource.data.authorId == request.auth.uid;
      // Owner can update/delete their campaign
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;

      // Group admins/moderators can manage campaigns that belong to their group
      allow update, delete: if isSignedIn() && resource.data.groupId != null && isGroupAdminOrMod(resource.data.groupId);

      // Platform admins can manage any campaign (needed for moderation delete/restore)
      // Admins can also set verification status (verified, verifiedAt, verifiedBy fields)
      allow update, delete: if isAdmin();

      // Public increments for donation and reactions only
      allow update: if isSignedIn() &&
        request.resource.data.diff(resource.data).changedKeys().hasOnly(["currentAmount","supporters","likesCount","sharesCount","likedBy","lastUpdateAt","lastUpdatePreview","updateCount"]);

      // Image fields stored as base64 in Firestore
      // Optional: If you store imageSizeKB numeric fields, constrain them here
      // allow create, update: if (!('imageSizeKB' in request.resource.data) || request.resource.data.imageSizeKB <= 500);

      // Community updates subcollection
      match /updates/{updateId} {
        allow read: if true;
        // Only the signed-in user may create an update as themself
        allow create: if isSignedIn() && request.resource.data.authorId == request.auth.uid;
        allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;
        // Platform admins can delete/restore any update during moderation
        allow update, delete: if isAdmin();
        // Public reaction counters
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }
    }

    // Transactions (donations/topups/withdrawals)
    match /transactions/{txId} {
      allow read: if isSignedIn();
      // Accept either senderId or donorId as the actor field (legacy compatibility)
      allow create: if isSignedIn() &&
        request.resource.data.type in ['donation', 'topup', 'withdraw'] &&
        (
          (request.resource.data.senderId != null && request.resource.data.senderId == request.auth.uid) ||
          (request.resource.data.donorId != null && request.resource.data.donorId == request.auth.uid)
        );
    }

    // Reports (content moderation)
    // Structure suggestion: { targetType: 'post'|'groupPost'|'comment', targetId, groupId?, reason, comment, status }
    match /reports/{rid} {
      allow read, create: if isSignedIn(); // anyone can file a report; listing is admin-only in UI
      allow update, delete: if isAdmin();  // only admins can modify/delete reports
    }

    // Moderation trash (soft-deletes with 3-day undo)
    // Structure: { refPath: string, targetType: string, createdAt: string, expireAt: string, original: map }
    // Only admins can read/write/delete here.
    match /moderationTrash/{tid} {
      allow read, create, update, delete: if isAdmin();
    }

    // Saved items (bookmarks)
    match /savedItems/{sid} {
      // Doc ID convention: `${userId}_${itemId}`
      // Owner can create, read their own, and remove their own saved items
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow update, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
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
      // Group owner, group admins/moderators, and platform admins can manage a group
      allow update: if isSignedIn() && (
        request.auth.uid == resource.data.ownerId ||
        isGroupAdminOrMod(groupId) ||
        isAdmin()
      );
      allow delete: if isSignedIn() && (
        request.auth.uid == resource.data.ownerId ||
        isGroupAdminOrMod(groupId) ||
        isAdmin()
      );

      // Group posts
      match /posts/{postId} {
        allow read: if true;
        allow create: if isSignedIn();
        allow update, delete: if isSignedIn() && (request.auth.uid == resource.data.authorId || isGroupAdminOrMod(groupId) || isAdmin());
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

    // Direct Messaging (Conversations)
    // Note: If you see "permission-denied" when starting a conversation,
    // ensure these rules are DEPLOYED in Firebase console.
    match /conversations/{conversationId} {
      // Helpers within this match
      function isConvParticipant() {
        return isSignedIn() && request.auth.uid in resource.data.participants;
      }
      function isCreateValid() {
        return isSignedIn()
          && ('participants' in request.resource.data)
          && request.resource.data.participants.size() == 2
          && request.auth.uid in request.resource.data.participants;
      }

      // Users can read only their conversations
      allow read: if isConvParticipant();

      // Create when caller is one of exactly two participants
      allow create: if isCreateValid();

      // Updates (e.g., lastMessageAt, unreadCount) by conversation participants
      allow update: if isConvParticipant();

      // Messages subcollection
      match /messages/{messageId} {
        function parentParticipants() {
          return get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        }
        // Participants can read all messages in their conversations
        allow read: if isSignedIn() && request.auth.uid in parentParticipants();

        // Participants can send messages; sender must match
        allow create: if isSignedIn()
          && request.auth.uid in parentParticipants()
          && request.auth.uid == request.resource.data.senderId;

        // 1) Sender may update their own message (e.g., minor edits handled in UI)
        // 2) Any participant may mark a message as read (read only field change)
        allow update: if isSignedIn() && (
          request.auth.uid == resource.data.senderId || (
            request.auth.uid in parentParticipants() &&
            request.resource.data.diff(resource.data).changedKeys().hasOnly(['read']) &&
            request.resource.data.read == true
          )
        );
      }
    }
  }
}

