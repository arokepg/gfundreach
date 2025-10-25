# Firestore Rules: Groups Admin/Moderator Permissions

To enable group admins and moderators to manage members and group posts/campaigns safely, update your Firestore Security Rules accordingly.

Below is a simplified example focused on the minimum needed for the features implemented here. Adapt to your full ruleset.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function isGroupAdminOrMod(groupId) {
      return exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role in ['admin','moderator'];
    }

    match /groups/{groupId} {
      allow read: if true;

      match /members/{userId} {
        allow read: if isSignedIn();
        // Admins/moderators can remove members or change roles
        allow delete, update: if isSignedIn() && isGroupAdminOrMod(groupId);
        // Users can join themselves (create their membership)
        allow create: if isSignedIn() && request.auth.uid == userId;
      }

      match /posts/{postId} {
        allow read: if true;
        // Admins/moderators can approve/delete group posts
        allow update, delete: if isSignedIn() && isGroupAdminOrMod(groupId);
        // Members may create a group post; status moderation handled by backend/clients
        allow create: if isSignedIn();
      }
    }

    // Campaigns (posts) collection
    match /posts/{postId} {
      allow read: if true;
      // Owner can update/delete own campaigns
      allow update, delete: if isSignedIn() && request.resource.data.authorId == request.auth.uid;
      allow create: if isSignedIn();
    }
  }
}
```

Notes:
- The `isGroupAdminOrMod` helper checks membership role inside the group. If you use a different schema, adjust accordingly.
- If you need admins/mods to edit group-owned campaigns in `/posts/{postId}` where `groupId == groupId`, you can add a rule exception that allows update/delete when `resource.data.groupId == groupId && isGroupAdminOrMod(groupId)`.
- Always test rules in the Firebase Rules Simulator before deploying.
