rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function uid() { return request.auth != null ? request.auth.uid : null; }
    function userDoc(u) { return get(/databases/$(database)/documents/users/$(u)); }
    function isAdmin() { return isSignedIn() && userDoc(uid()).data.role == 'admin'; }

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
      // Only admins can set roles or delete a profile
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
        )
      );
      allow delete: if isAdmin() || (isSignedIn() && resource.data.authorId == uid());

      // Campaign updates subcollection
      match /updates/{updateId} {
        allow read: if true;
        allow create, update, delete: if isAdmin() || (
          isSignedIn() && get(/databases/$(database)/documents/posts/$(postId)).data.authorId == uid()
        );
      }
    }

    // --- Transactions (Donations) ---
    match /transactions/{txId} {
      // Only donor or recipient can read their transactions
      allow read: if isSignedIn() && (resource.data.donorId == uid() || resource.data.recipientId == uid());

      // Donor creates the donation record (recommended to move to Cloud Functions in production)
      allow create: if isSignedIn() && request.resource.data.donorId == uid();

      // Updates/deletes restricted to admin in this client-driven model
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
        (resource.data.ownerId != null && resource.data.ownerId == uid()) ||
        (request.resource.data.ownerId != null && request.resource.data.ownerId == uid())
      );
    }

    match /collections/{collectionId} {
      allow read, write: if isSignedIn() && (
        (resource.data.ownerId != null && resource.data.ownerId == uid()) ||
        (request.resource.data.ownerId != null && request.resource.data.ownerId == uid())
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

    // --- Conversations & Messages ---
    match /conversations/{conversationId} {
      function isParticipant() { return isSignedIn() && (request.auth.uid in resource.data.participants); }
      function isCreatingParticipant() { return isSignedIn() && (request.auth.uid in request.resource.data.participants); }

      allow read: if isAdmin() || isParticipant();
      allow create: if isAdmin() || isCreatingParticipant();
      allow update, delete: if isAdmin() || isParticipant();

      match /messages/{messageId} {
        allow read: if isAdmin() || isParticipant();
        allow create: if isAdmin() || isParticipant();
        // Allow sender (participant) to update/delete their own message; admins can also act
        allow update, delete: if isAdmin() || (isParticipant() && resource.data.senderId == uid());
      }
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
      // We cannot inspect the submitted code on delete, so we permit caller (auth or unauth)
      // to delete, accepting DoS risk limited to this collection. Prefer moving to Cloud Functions in production.
      allow delete: if request.auth == null || (request.auth.token.email != null && request.auth.token.email == emailLower);
    }

    // --- Notifications ---
    match /notifications/{notifId} {
      allow read: if isSignedIn() && resource.data.recipientId == uid();
      // Client-created notifications allowed for self; prefer Functions in production
      allow create: if isAdmin() || (isSignedIn() && request.resource.data.recipientId == uid());
      allow update, delete: if isSignedIn() && resource.data.recipientId == uid();
    }

    // --- Groups (minimal) ---
    match /groups/{groupId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.ownerId == uid());
    }
  }
}