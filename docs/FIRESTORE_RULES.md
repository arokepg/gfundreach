rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ------------------------------------------------------------------
    // Group Admin/Moderator Moderation Permissions
    // Added: Allow group admins/moderators to manage (update/delete)
    // - Campaign posts in top-level /posts when post has a groupId
    // - Group feed posts in /groups/{groupId}/posts
    // These permissions enable admins to moderate content created by others
    // inside their group while preserving owners' rights and public reactions.
    // ------------------------------------------------------------------
    // Group role helper: checks if the caller is an admin or moderator of the group
    function isGroupAdminOrMod(groupId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role in ['admin', 'moderator'];
    }
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    
    // Validate likedBy toggles safely without using unsupported statements
    // Avoids 'let' and 'if' statements by returning a boolean expression.
    function listSize(l) {
      return l == null ? 0 : l.size();
    }

    function isValidLikeToggle() {
      return (
        // If likedBy is not being changed, it's valid
        !("likedBy" in request.resource.data)
        // added like: new = old + actor
        || (
          request.resource.data.likedBy.size() == listSize(resource.data.likedBy) + 1
          && request.resource.data.likedBy.hasAll(resource.data.likedBy)
          && request.resource.data.likedBy.hasAny([request.auth.uid])
        )
        // removed like: old = new + actor
        || (
          listSize(resource.data.likedBy) == request.resource.data.likedBy.size() + 1
          && resource.data.likedBy.hasAll(request.resource.data.likedBy)
          && resource.data.likedBy.hasAny([request.auth.uid])
        )
      );
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      // Users can update their own profile and wallet metrics
      allow update, delete: if isOwner(userId);
      allow create: if isSignedIn();
    }

    // Campaign posts
    match /posts/{postId} {
      allow read: if true;
      // Create: any signed-in user can create a campaign
      allow create: if isSignedIn();
      // Owner can update/delete their campaign
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;

      // Allow group admins/moderators to manage campaigns that belong to their group
      // i.e., when the campaign has a groupId field
      allow update, delete: if isSignedIn() && resource.data.groupId != null && isGroupAdminOrMod(resource.data.groupId);

      // Allow specific public increments for donation and reactions
      // Note: permissive reaction updates (likes/shares) are allowed for any signed-in user.
      allow update: if isSignedIn() &&
        request.resource.data.diff(resource.data).changedKeys().hasOnly(["currentAmount","supporters","likesCount","sharesCount","likedBy","lastUpdateAt","lastUpdatePreview","updateCount"]);

      // Community updates subcollection
      match /updates/{updateId} {
        allow read: if true;
        allow create: if isSignedIn();
        // Author can edit/delete own update
        allow update, delete: if isSignedIn() && request.auth.uid == resource.data.authorId;
        // Allow public reaction counters and likedBy toggles
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }
    }

    // Transactions (donations)
    match /transactions/{txId} {
      allow read: if isSignedIn();
      // Any signed-in user can create a donation record for their donation
      allow create: if isSignedIn() && request.resource.data.donorId == request.auth.uid &&
        request.resource.data.type == 'donation';
    }

    // Saved items (bookmarks)
    match /savedItems/{sid} {
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      // Doc ID convention: `${userId}_${itemId}`
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
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
      // Only recipient can read/update/delete their notifications
      allow read, update, delete: if isSignedIn() && resource.data.recipientId == request.auth.uid;
      // Any signed-in user can create a notification addressed to someone
      // (You may further restrict allowed types or require senderId == auth.uid when provided.)
      allow create: if isSignedIn();
    }

    // Groups
    match /groups/{groupId} {
      allow read: if true;
      allow create: if isSignedIn();
      // Group owner manages group
      allow update, delete: if isSignedIn() && request.auth.uid == resource.data.ownerId;

      // Group posts (simple version). For strict membership checks, add a members subcollection gate.
      match /posts/{postId} {
        allow read: if true;
        allow create: if isSignedIn();
        // Author OR admin/mod can update/delete
        allow update, delete: if isSignedIn() && (request.auth.uid == resource.data.authorId || isGroupAdminOrMod(groupId));
        // Public reactions
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }

      // Optional strict membership gate example:
      match /members/{uid} {
        allow read: if isSignedIn();
        // Users can join themselves
        allow create: if isSignedIn() && request.auth.uid == uid;
        // Members can remove themselves; admins/mods can remove any member
        allow delete: if isSignedIn() && (request.auth.uid == uid || isGroupAdminOrMod(groupId));
        // Admins/mods can update member doc (e.g., change role)
        allow update: if isSignedIn() && isGroupAdminOrMod(groupId);
      }
    }
  }
}