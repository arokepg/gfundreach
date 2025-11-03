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
      // Allow read access to all signed-in users for:
      // 1. User search in messaging (finding new people to message)
      // 2. Profile viewing
      // 3. Friend requests and social features
      allow read: if isSignedIn();
      
      allow create: if isSignedIn();
      allow update, delete: if isOwner(userId);
      
      // Allow users to update their own greeting message
      allow update: if isSignedIn() && request.auth.uid == userId &&
        request.resource.data.diff(resource.data).changedKeys().hasOnly(['greetingMessage']);
      
      // Note: User search implementation in Messages.jsx:
      // - Uses prefix matching on displayName field
      // - Requires Firestore index: displayName (ascending)
      // - Query pattern: where('displayName', '>=', searchLower).where('displayName', '<=', searchLower + '\uf8ff')
      // - For production, consider Algolia/ElasticSearch for better full-text search
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

      // View tracking subcollections
      // 1) Views: one document per view (anonymous allowed). Structure suggestion:
      //    { visitorId, visitorKey, userId?, dateKey, createdAt }
      match /views/{viewId} {
        // Anyone can create a view record; reads are public
        allow create: if true;
        allow read: if true;
        // Disallow updates/deletes to keep events immutable
        allow update, delete: if false;
      }

      // 2) Visitors: one document per unique person (userId) or per device if anonymous
      //    { visitorId, userId?, keyType: 'user'|'device', lastViewedAt }
      match /visitors/{key} {
        // Anyone can upsert their own visit marker
        allow create, update: if true;
        // Only the campaign owner (or admin) should read unique visitor markers
        allow read: if isSignedIn() && (
          get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid ||
          isAdmin()
        );
        // No deletes from clients
        allow delete: if false;
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
    // 
    // The isStranger field is computed client-side by checking friendship status.
    // It's not stored in Firestore, so no special rules are needed for it.
    //
    // For group conversations, the creator is stored in createdBy field and
    // automatically becomes the admin. Only the creator/admin can update group settings.
    match /conversations/{conversationId} {
      // Helpers within this match
      function isConvParticipant() {
        return isSignedIn() && request.auth.uid in resource.data.participants;
      }
      function isCreateValid() {
        return isSignedIn()
          && ('participants' in request.resource.data)
          && request.resource.data.participants.size() >= 2
          && request.auth.uid in request.resource.data.participants;
      }
      function isGroupAdmin() {
        return isSignedIn() 
          && resource.data.type == 'group'
          && (
            // Creator is always admin
            ('createdBy' in resource.data && resource.data.createdBy == request.auth.uid) ||
            // Or explicitly set as admin in roles
            ('roles' in resource.data && resource.data.roles[request.auth.uid] == 'admin')
          );
      }

      // Users can read only their conversations
      allow read: if isConvParticipant();

      // Create when caller is one of participants (supports 1-1 and groups)
      // For group conversations, automatically set createdBy to creator's UID
      allow create: if isCreateValid();

      // Updates depend on what's being changed:
      // - Participants can update: lastMessageAt, unreadCount, typing, firstMessageSent
      // - Only group admins can update: settings (name, groupImageUrl, invitePermission), roles
      // - Group admins can approve/reject invites (pendingInvites)
      allow update: if isConvParticipant() && (
        // Regular conversation updates (messaging activity)
        request.resource.data.diff(resource.data).changedKeys().hasOnly(['lastMessageAt', 'unreadCount', 'typing', 'firstMessageSent', 'participantNames', 'participantPhotos']) ||
        // Admin-only: settings, roles, and invite management
        (isGroupAdmin() && resource.data.type == 'group')
      );

      // Delete conversation: any participant can delete the entire conversation
      // Note: Client must handle message deletion separately using batch operations
      // Implementation in messaging.js uses writeBatch to delete messages first, then conversation
      allow delete: if isConvParticipant();

      // Messages subcollection
      match /messages/{messageId} {
        function parentParticipants() {
          return get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        }
        // Participants can read all messages in their conversations
        allow read: if isSignedIn() && request.auth.uid in parentParticipants();

        // Participants can send messages; sender must match
        // Support text, audio, image, campaign card types
        allow create: if isSignedIn()
          && request.auth.uid in parentParticipants()
          && request.auth.uid == request.resource.data.senderId;

        // 1) Sender may update their own message (e.g., minor edits handled in UI)
        // 2) Any participant may mark a message as read (read only field change)
        // 3) Any participant may add/remove reactions (reactions field)
        allow update: if isSignedIn() && (
          request.auth.uid == resource.data.senderId || (
            request.auth.uid in parentParticipants() &&
            (
              (
                request.resource.data.diff(resource.data).changedKeys().hasOnly(['read']) &&
                request.resource.data.read == true
              ) ||
              request.resource.data.diff(resource.data).changedKeys().hasOnly(['reactions'])
            )
          )
        );

        // Delete message: any participant can delete messages
        // Used during conversation deletion (bulk delete via writeBatch)
        allow delete: if isSignedIn() && request.auth.uid in parentParticipants();
      }
    }
  }
}