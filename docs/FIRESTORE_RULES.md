rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helpers
    function isSignedIn() { return request.auth != null; }
    function uid() { return isSignedIn() ? request.auth.uid : null; }
    function userDoc(u) { return get(/databases/$(database)/documents/users/$(u)); }
    function isAdmin() { return isSignedIn() && userDoc(uid()).data.role == 'admin'; }
    function isGroupAdminOrMod(groupId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/groups/$(groupId)/members/$(uid())) &&
        get(/databases/$(database)/documents/groups/$(groupId)/members/$(uid())).data.role in ['admin','moderator'];
    }

    // --- Users ---
    match /users/{userId} {
      // Allow signed-in users to read user profiles (needed to render names/avatars)
      allow read: if isSignedIn();

      // Users can create or update their own profile, but cannot elevate role
      allow create: if isSignedIn() && uid() == userId;
      allow update: if isSignedIn() && uid() == userId && (
        // Role cannot be changed by non-admins
        (request.resource.data.role == resource.data.role)
      );
      // Only admins can delete a profile
      allow delete: if isAdmin();
      allow update: if isAdmin();
    }

    // --- Campaign Posts ---
    match /posts/{postId} {
      allow read: if true; // public campaigns

      // Author creates and can update their own campaign, but cannot toggle admin-only flags
      allow create: if isSignedIn() && request.resource.data.authorId == uid();
      allow update: if isSignedIn() && (
        isAdmin() || (
          resource.data.authorId == uid() &&
          // Prevent non-admins from changing moderation fields
          request.resource.data.verified == resource.data.verified &&
          request.resource.data.hidden == resource.data.hidden &&
          request.resource.data.status == resource.data.status
        ) || (resource.data.groupId != null && isGroupAdminOrMod(resource.data.groupId))
      );
      allow delete: if isAdmin() || (isSignedIn() && resource.data.authorId == uid());

      // Campaign updates subcollection
      match /updates/{updateId} {
        allow read: if true;
        allow create, update, delete: if isAdmin() || (
          isSignedIn() && get(/databases/$(database)/documents/posts/$(postId)).data.authorId == uid()
        );
        // NOTE: Public read allows a user's profile to aggregate their community posts
        // across campaigns they don't own. This supports viewing all authored updates
        // on the profile page without additional per-campaign permission checks.
      }

      // Optional analytics subcollections used by the app
      match /views/{viewId} {
        allow create: if true;
        allow read: if true;
        allow update, delete: if false;
      }

      match /visitors/{key} {
        allow create, update: if true;
        allow read: if isSignedIn() && (
          get(/databases/$(database)/documents/posts/$(postId)).data.authorId == uid() ||
          isAdmin()
        );
        allow delete: if false;
      }
    }

    // --- Transactions (Donations) ---
    match /transactions/{txId} {
      // Only donor or recipient can read their transactions
      allow read: if isSignedIn() && (resource.data.donorId == uid() || resource.data.recipientId == uid());

      // Donor creates the donation record (recommended to move to Cloud Functions in production)
      allow create: if isSignedIn() && request.resource.data.donorId == uid();

      // Updates/deletes restricted to admins in this client-driven model
      allow update, delete: if isAdmin();
    }

    // --- Friendships ---
    match /friendships/{friendshipId} {
      // Friendships use deterministic IDs (sorted pair) and store:
      //  - users: array of 2 user IDs (sorted)
      //  - status: 'pending' or 'accepted'
      //  - requestedBy: userId who initiated the request

      // Allow read if current user is one of the participants
      allow read: if isSignedIn() && (uid() in resource.data.users);

      // Allow create if current user is the requester and is in the users array
      allow create: if isSignedIn() &&
        request.resource.data.requestedBy == uid() &&
        uid() in request.resource.data.users &&
        request.resource.data.status == 'pending';

      // Allow update if:
      // - User is accepting a request (changing status to 'accepted' when they're NOT the requester)
      // - Or user is the requester (timestamp bumps, etc.)
      allow update: if isSignedIn() &&
        uid() in resource.data.users &&
        (
          (resource.data.requestedBy != uid() && request.resource.data.status == 'accepted') ||
          (resource.data.requestedBy == uid())
        );

      // Either participant can delete (cancel request or unfriend)
      allow delete: if isSignedIn() && (uid() in resource.data.users);
    }

    // --- Saved Items & Collections ---
    match /savedItems/{savedId} {
      allow read, write: if isSignedIn() && (
        (resource.data.userId != null && resource.data.userId == uid()) ||
        (request.resource.data.userId != null && request.resource.data.userId == uid())
      );
    }

    match /collections/{collectionId} {
      allow read, write: if isSignedIn() && (
        (resource.data.userId != null && resource.data.userId == uid()) ||
        (request.resource.data.userId != null && request.resource.data.userId == uid())
      );
    }

    // --- Reports & Moderation ---
    match /reports/{reportId} {
      allow create: if isSignedIn();
      allow read, update, delete: if isAdmin();
    }

    match /moderationTrash/{docId} {
      allow read, write: if isAdmin();
    }

    // --- Verification Codes (Register + 2FA Login) ---
    // Notes:
    //  - Register flow may occur BEFORE sign-in, so unauthenticated writes must be allowed with constraints.
    //  - Login 2FA may also occur pre-session. We therefore validate fields strictly and limit what can change.
    //  - Reads remain disallowed to prevent leakage of codes.
    match /verificationCodes/{emailLower} {
      allow read: if false; // never expose codes

      // Create rules (register/login): allow unauth OR same-email signed-in user
      allow create: if (
        // Unauthenticated create allowed with strict validation
        request.auth == null ||
        // Or signed-in user creating for their own email
        (request.auth.token.email != null && request.auth.token.email == emailLower)
      ) &&
      // Required minimal fields and values
      (request.resource.data.keys().hasOnly(['email','code','type','createdAt','expiresAt','attempts'])
        && request.resource.data.email == emailLower
        && request.resource.data.type in ['register','login']
        && request.resource.data.code is string
        && request.resource.data.attempts == 0);

      // Update rules: allow resend (code/expiresAt) and attempt increments only
      allow update: if (
        request.auth == null || (request.auth.token.email != null && request.auth.token.email == emailLower)
      ) && (
        request.resource.data.diff(resource.data).changedKeys().hasOnly(['code','expiresAt','attempts'])
        && request.resource.data.attempts <= 5
      );

      // Delete rules: allow cleanup after success or expiry
      allow delete: if request.auth == null || (request.auth.token.email != null && request.auth.token.email == emailLower);
    }

    // --- Notifications ---
    match /notifications/{notifId} {
      allow read: if isSignedIn() && resource.data.recipientId == uid();
      // Client-created notifications allowed for self; prefer Functions in production
      allow create: if isAdmin() || (isSignedIn() && request.resource.data.recipientId == uid());
      allow update, delete: if isSignedIn() && resource.data.recipientId == uid();
    }

    // --- Groups (with members and posts) ---
    match /groups/{groupId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.ownerId == uid());

      match /posts/{postId} {
        allow read: if true;
        allow create: if isSignedIn();
        allow update, delete: if isSignedIn() && (resource.data.authorId == uid() || isGroupAdminOrMod(groupId) || isAdmin());
        allow update: if isSignedIn() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["likesCount","sharesCount","likedBy"]);
      }

      match /members/{memberUid} {
        allow read: if isSignedIn();
        allow create: if isSignedIn() && memberUid == uid();
        allow delete: if isSignedIn() && (memberUid == uid() || isGroupAdminOrMod(groupId));
        allow update: if isSignedIn() && isGroupAdminOrMod(groupId);
      }
    }

    // --- Conversations & Messages ---
    match /conversations/{conversationId} {
      function isConvParticipant() {
        return isSignedIn() && (uid() in resource.data.participants);
      }
      function isCreateValid() {
        return isSignedIn() &&
          ('participants' in request.resource.data) &&
          request.resource.data.participants.size() >= 2 &&
          (uid() in request.resource.data.participants);
      }
      function isGroupAdminConv() {
        return isSignedIn() &&
          resource.data.type == 'group' &&
          (
            ('createdBy' in resource.data && resource.data.createdBy == uid()) ||
            ('roles' in resource.data && resource.data.roles[uid()] == 'admin')
          );
      }

      allow read: if isConvParticipant();
      allow create: if isCreateValid();

      // Allow updates for regular activity, admin-only group settings, auto-invite, and leave/kick flows
      allow update: if isConvParticipant() && (
        request.resource.data.diff(resource.data).changedKeys().hasOnly(['lastMessageAt','lastMessage','lastSenderId','unreadCount','typing','firstMessageSent','participantNames','participantPhotos','hasReplied']) ||
        (isGroupAdminConv() && resource.data.type == 'group') ||
        (isConvParticipant() && resource.data.type == 'group' &&
         resource.data.settings.invitePermission == 'auto' &&
         request.resource.data.diff(resource.data).changedKeys().hasOnly(['participants','participantNames','participantPhotos','unreadCount','roles'])) ||
        (
          isConvParticipant() &&
          resource.data.type == 'group' &&
          request.resource.data.participants.size() < resource.data.participants.size() &&
          (
            (!(uid() in request.resource.data.participants) && uid() in resource.data.participants) ||
            isGroupAdminConv()
          ) &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(['participants','lastMessage','lastMessageAt','participantNames','participantPhotos','unreadCount','roles'])
        )
      );

      allow delete: if isConvParticipant() && (
        resource.data.type != 'group' || (resource.data.type == 'group' && isGroupAdminConv())
      );

      match /messages/{messageId} {
        function parentParticipants() {
          return get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        }
        allow read: if isSignedIn() && (uid() in parentParticipants());

        // Allow creating messages: sender must match or system message by any participant
        allow create: if isSignedIn() && (uid() in parentParticipants()) && (
          (request.resource.data.senderId == uid()) ||
          (request.resource.data.type == 'system')
        );

        allow update: if isSignedIn() && (
          uid() == resource.data.senderId || (
            uid() in parentParticipants() && (
              (
                request.resource.data.diff(resource.data).changedKeys().hasOnly(['read']) &&
                request.resource.data.read == true
              ) ||
              request.resource.data.diff(resource.data).changedKeys().hasOnly(['reactions'])
            )
          )
        );

        allow delete: if isSignedIn() && (uid() in parentParticipants());
      }
    }
  }
}
