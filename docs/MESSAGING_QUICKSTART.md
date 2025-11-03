# Messaging System - Quick Start Guide

## 🚀 Deployment Steps

### 1. Deploy Firestore Rules
Open Firebase Console → Firestore Database → Rules, add these rules:

```javascript
// Inside match /conversations/{conversationId}
match /conversations/{conversationId} {
  function isConvParticipant() {
    return isSignedIn() && request.auth.uid in resource.data.participants;
  }
  function isCreateValid() {
    return isSignedIn()
      && ('participants' in request.resource.data)
      && request.resource.data.participants.size() >= 2  // Changed from == 2 to >= 2
      && request.auth.uid in request.resource.data.participants;
  }

  allow read: if isConvParticipant();
  allow create: if isCreateValid();
  allow update: if isConvParticipant();

  match /messages/{messageId} {
    function parentParticipants() {
      return get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    }
    allow read: if isSignedIn() && request.auth.uid in parentParticipants();
    allow create: if isSignedIn()
      && request.auth.uid in parentParticipants()
      && request.auth.uid == request.resource.data.senderId;
    
    // Support reactions
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
  }
}

// Inside match /posts/{postId}
// Add these for view tracking:
match /views/{viewId} {
  allow create: if true;
  allow read: if true;
  allow update, delete: if false;
}

match /visitors/{key} {
  allow create, update: if true;
  allow read: if isSignedIn() && (
    get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid ||
    isAdmin()
  );
  allow delete: if false;
}
```

Click **Publish** to deploy.

### 2. Create Composite Indexes (if needed)

If you see index errors in console, create these indexes:

**For Conversations:**
- Collection: `conversations`
- Fields: `participants` (Array), `lastMessageAt` (Descending)

**For User Search:**
- Collection: `users`
- Fields: `displayName` (Ascending)

**For Transactions (Donors):**
- Collection: `transactions`
- Fields: `postId` (Ascending), `type` (Ascending)

Firebase will show a clickable link in console errors to auto-create indexes.

### 3. Test the Features

#### Test 1: Send Message with Campaign Context
1. Log in as User A
2. Visit a campaign created by User B
3. Click "Message Creator"
4. Campaign card should auto-appear in chat
5. Type a text message and send

#### Test 2: Send Image
1. In any chat, click the Image icon
2. Select an image < 500KB
3. Image should appear in chat

#### Test 3: Send Voice Message
1. Click Mic icon
2. Allow microphone permission
3. Speak for a few seconds
4. Click Stop
5. Audio player should appear

#### Test 4: React to Message
1. Hover over any message bubble
2. Click the Smile icon
3. Select an emoji (e.g., 👍)
4. Reaction should appear below message

#### Test 5: Create Donor Group
1. Log in as campaign owner
2. Open your campaign with donations
3. Click "Create Donor Group Chat"
4. Select donors (auto-selected by default)
5. Click "Create Group Chat"
6. Group conversation opens

#### Test 6: User Search
1. Go to /messages
2. Click "New Message" tab
3. Type a user's name
4. Click a user from results
5. Conversation starts

### 4. Monitor & Debug

**Check Browser Console:**
- Look for "recordCampaignView failed:" errors
- Check for "Failed to send message" errors
- Verify no permission-denied errors

**Check Firebase Console:**
- Firestore → conversations → verify documents created
- Firestore → posts/{id}/views → verify view events
- Firestore → posts/{id}/visitors → verify unique visitors

**Common Issues:**

| Error | Solution |
|-------|----------|
| Permission denied creating conversation | Deploy updated rules |
| Image too large | Compress image < 500KB |
| Voice recording fails | Check mic permissions |
| User search returns no results | Create displayName index |
| Group creation fails | Verify user is campaign owner |

## 📁 Files Modified

### New Files
- `src/components/CampaignContextCard.jsx` - Campaign preview card
- `src/pages/user/CreateCampaignGroup.jsx` - Group creation page
- `docs/MESSAGING_FEATURES.md` - Full documentation

### Modified Files
- `src/utils/messaging.js` - Added image, voice, reactions, groups
- `src/pages/user/ChatWindow.jsx` - Enhanced UI with reactions, images, groups
- `src/pages/user/Messages.jsx` - Group support
- `src/components/MessageButton.jsx` - Auto-attach campaign context
- `src/pages/user/CampaignDetail.jsx` - Group creation button, context pass
- `src/App.jsx` - New route for group creation
- `docs/FIRESTORE_RULES.md` - Updated rules

## 🎯 Feature Checklist

- [x] Text messages (1-1 and groups)
- [x] Image messages (base64, < 500KB)
- [x] Voice messages (WebM, < 30s)
- [x] Emoji reactions (6 common emojis)
- [x] Campaign context cards (auto-attach)
- [x] Group chat creation (campaign donors)
- [x] User search (new conversations)
- [x] Unread counts (per user, per conversation)
- [x] Real-time updates (Firestore subscriptions)
- [x] Group message support
- [x] Firestore rules (groups, reactions, views)
- [ ] Typing indicators UI (data structure ready)
- [ ] Push notifications (future)
- [ ] Message search (future)
- [ ] File attachments (future)

## 📊 Performance & Limits

**Firestore Document Limits:**
- Max doc size: 1MB
- Image recommendation: < 500KB (base64 ~33% larger)
- Voice recommendation: < 30s (~700KB blob)

**Query Limits:**
- Messages per conversation: 100 (last)
- User search results: 10
- Conversations list: 50 (last)

**Real-time Updates:**
- Messages: onSnapshot (instant)
- Conversations list: onSnapshot (instant)
- Typing: serverTimestamp (< 1s delay)

## 🔒 Security Notes

- All message writes validate senderId matches auth.uid
- Only conversation participants can read messages
- Group creation only by campaign owner
- Image/voice size guards prevent Firestore limit overflow
- Campaign context validated before sending

## 📖 Full Documentation

See `docs/MESSAGING_FEATURES.md` for:
- Detailed API documentation
- Code examples for each feature
- Data structure schemas
- Troubleshooting guide
- Future enhancement ideas

## 🆘 Support

If you encounter issues:
1. Check browser console for errors
2. Verify Firestore rules are deployed
3. Ensure indexes are created (click console links)
4. Check user permissions (auth state)
5. Review `docs/MESSAGING_FEATURES.md`

---

**Ready to go!** 🎉 Deploy rules, test features, and enjoy the enhanced messaging system.
