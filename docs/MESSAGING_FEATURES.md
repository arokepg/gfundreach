# Messaging System - Feature Documentation

## Overview
Hệ thống nhắn tin đã được nâng cấp toàn diện với các tính năng hiện đại bao gồm tin nhắn văn bản, hình ảnh, giọng nói, reactions, và tích hợp campaign context cards.

## Core Features Implemented

### 1. Enhanced Direct Messaging (1-1 Chats)

#### Text Messages
- Tin nhắn văn bản thông thường
- Real-time updates với Firestore subscriptions
- Hiển thị trạng thái đã đọc/chưa đọc
- Bubble design với màu khác biệt cho sender/receiver

#### Image Messages
- **Gửi ảnh**: Click nút Image icon trong input area
- **Giới hạn**: Max 500KB (recommended) để tránh vượt quá Firestore 1MB limit
- **Lưu trữ**: Base64 data URLs trong Firestore (không cần Firebase Storage)
- **Preview**: Hiển thị ảnh thumbnail trực tiếp trong chat

**Code Usage:**
```javascript
import { sendImageMessage } from '../../utils/messaging';

await sendImageMessage(
  conversationId,
  senderId,
  senderName,
  imageDataUrl, // base64 data URL
  'Optional caption'
);
```

#### Voice Messages
- **Thu âm**: Click nút Mic để bắt đầu, nút Stop để gửi
- **Giới hạn**: ~30 seconds (max ~700KB blob)
- **Format**: WebM/Opus hoặc fallback browser defaults
- **Player**: HTML5 audio player với controls

**Code Usage:**
```javascript
import { sendVoiceMessage } from '../../utils/messaging';

await sendVoiceMessage(
  conversationId,
  senderId,
  senderName,
  audioDataUrl, // base64 audio data
  durationMs
);
```

#### Reactions (Emoji)
- **Thêm reaction**: Hover message bubble → click Smile icon → chọn emoji
- **Common emojis**: 👍 ❤️ 😂 😮 😢 🙏
- **Toggle**: Click reaction để add/remove
- **Hiển thị**: Reactions hiện bên dưới message với count

**Code Usage:**
```javascript
import { addReaction, removeReaction } from '../../utils/messaging';

// Add reaction
await addReaction(conversationId, messageId, userId, '👍');

// Remove reaction
await removeReaction(conversationId, messageId, userId, '👍');
```

### 2. Campaign Context Cards

#### Auto-attach từ Campaign Page
- Khi click "Message Creator" từ campaign detail page
- Campaign info tự động gửi dưới dạng context card
- Hiển thị: title, description, progress bar, image, category

#### Manual Share (Future Enhancement)
- Share campaign link trực tiếp trong chat
- Render campaign preview card

**Component:**
```jsx
<CampaignContextCard 
  campaign={campaignData} 
  compact={false} // or true for inline
/>
```

**Send Campaign Card:**
```javascript
import { sendCampaignCard } from '../../utils/messaging';

await sendCampaignCard(
  conversationId,
  senderId,
  senderName,
  {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    imageUrl: campaign.imageUrl,
    category: campaign.category,
    currentAmount: campaign.currentAmount,
    goalAmount: campaign.goalAmount,
    supporters: campaign.supporters
  }
);
```

### 3. Group Chat for Donors/Helpers

#### Create Group
- **Owner only**: Campaign owner có nút "Create Donor Group Chat"
- **Route**: `/campaign/:campaignId/create-group`
- **Selection**: Chọn donors từ danh sách (auto-select all by default)
- **Name**: Tự động đặt tên "{CampaignTitle} - Supporters Group"

#### Group Features
- **Multi-participant**: Support 2+ members
- **Group info**: Hiển thị số members trong header
- **Messages**: Tất cả members đều có thể gửi/nhận
- **Unread counts**: Riêng cho từng member

**Code Usage:**
```javascript
import { createGroupConversation, sendGroupMessage } from '../../utils/messaging';

// Create group
const groupId = await createGroupConversation(
  creatorId,
  creatorName,
  [donorId1, donorId2, ...], // participant IDs
  [{id: donorId1, name: 'Donor 1', photo: '...'}, ...], // participant data
  'Group Name',
  { // optional context
    type: 'campaign',
    campaignId: 'xyz',
    campaignTitle: 'My Campaign'
  }
);

// Send group message
await sendGroupMessage(conversationId, senderId, senderName, content);
```

### 4. User Search & New Messages

#### Search Users
- **Tab "New Message"** trong Messages page
- **Search bar**: Tìm user theo displayName
- **Debounced**: 300ms delay
- **Limit**: Top 10 results
- **Index required**: Composite index on displayName (ascending)

#### Start Conversation
- Click user từ search results
- Auto-create 1-1 conversation
- Navigate to chat window

### 5. Typing Indicators (Future Enhancement)
```javascript
import { updateTypingStatus } from '../../utils/messaging';

// Set typing
await updateTypingStatus(conversationId, userId, true);

// Clear typing
await updateTypingStatus(conversationId, userId, false);
```

## Firestore Data Structure

### Conversations Collection
```javascript
{
  type: 'direct' | 'group', // omit type for 1-1 (backward compat)
  participants: [uid1, uid2, ...],
  participantNames: { uid1: 'Name 1', uid2: 'Name 2' },
  participantPhotos: { uid1: 'photo1.jpg', uid2: '' },
  groupName: 'Group Chat Name', // for groups only
  createdBy: uid, // for groups
  lastMessage: 'Last message text...',
  lastMessageAt: Timestamp,
  unreadCount: { uid1: 0, uid2: 3 },
  typing: { uid1: Timestamp | null }, // optional
  context: { // optional, for campaign groups
    type: 'campaign',
    campaignId: 'xyz',
    campaignTitle: 'Title'
  },
  createdAt: Timestamp
}
```

### Messages Subcollection
```javascript
{
  senderId: uid,
  senderName: 'Sender Name',
  type: 'text' | 'audio' | 'image' | 'campaign', // omit for text
  content: 'Message text',
  
  // Type-specific fields:
  audioUrl: 'data:audio/webm;base64,...', // for audio
  audioDuration: 5000, // ms, for audio
  imageUrl: 'data:image/png;base64,...', // for image
  caption: 'Image caption', // for image
  campaign: { // for campaign type
    id, title, description, imageUrl, category,
    currentAmount, goalAmount, supporters
  },
  
  reactions: { // optional
    '👍': [uid1, uid2],
    '❤️': [uid3]
  },
  read: false,
  createdAt: Timestamp
}
```

## Firestore Rules Summary

```javascript
match /conversations/{conversationId} {
  // Read/update: participants only
  allow read, update: if isConvParticipant();
  
  // Create: caller must be in participants (2+ for groups)
  allow create: if isCreateValid();
  
  match /messages/{messageId} {
    // Read: participants
    allow read: if request.auth.uid in parentParticipants();
    
    // Create: participants, senderId must match
    allow create: if ... && request.auth.uid == request.resource.data.senderId;
    
    // Update: sender (edit) or any participant (read flag, reactions)
    allow update: if ...;
  }
}
```

## UI Components

### Pages
- **Messages.jsx**: Conversations list + user search
- **ChatWindow.jsx**: Chat interface với messages + input
- **CreateCampaignGroup.jsx**: Group creation wizard

### Components
- **MessageButton.jsx**: Nút "Message Creator" với auto-attach context
- **CampaignContextCard.jsx**: Campaign preview card trong chat

### Utils
- **messaging.js**: All messaging functions (send, reactions, groups, etc.)

## Navigation Routes

```javascript
// In App.jsx
<Route path="/messages" element={<Messages />} />
<Route path="/messages/:conversationId" element={<ChatWindow />} />
<Route path="/campaign/:campaignId/create-group" element={<CreateCampaignGroup />} />
```

## Testing Checklist

### 1-1 Chat
- [ ] Send text message
- [ ] Send image (< 500KB)
- [ ] Send voice message (< 30s)
- [ ] Add reaction to message
- [ ] Remove reaction
- [ ] Unread count updates
- [ ] Mark as read on open

### Campaign Context
- [ ] Message Creator từ campaign page
- [ ] Context card auto-sent
- [ ] Click card navigates to campaign

### Group Chat
- [ ] Create group as campaign owner
- [ ] Select/deselect donors
- [ ] Group name editable
- [ ] Navigate to group chat
- [ ] All members can send/receive
- [ ] Group icon (Users) displays
- [ ] Member count shown

### User Search
- [ ] Search users by name
- [ ] Debounced search (300ms)
- [ ] Start new conversation
- [ ] Navigate to chat

## Known Limitations & Future Enhancements

### Current Limitations
1. **Image size**: Must compress images < 500KB before sending
2. **Voice duration**: Recommend < 30 seconds for size limits
3. **Search**: Prefix match only (no full-text search)
4. **Typing indicators**: Data structure ready but UI not implemented yet

### Future Enhancements
1. **Typing indicators**: Show "User is typing..." in real-time
2. **Read receipts**: Show checkmark per-message
3. **Media compression**: Auto-compress images/audio on client
4. **File sharing**: Support PDFs, documents
5. **Message search**: Search within conversation history
6. **@Mentions**: Tag users in group chats
7. **Push notifications**: FCM integration
8. **Message forwarding**: Share messages to other chats
9. **Reply threads**: Quote/reply to specific messages
10. **Campaign sharing UI**: Button to share any campaign in chat

## Performance Notes

- **Real-time**: Firestore onSnapshot for instant updates
- **Pagination**: Currently loads last 100 messages (increase if needed)
- **Debouncing**: User search debounced 300ms
- **Throttling**: View tracking throttled 1.5s to prevent double-counts
- **Indexes needed**:
  - `conversations`: participants (array), lastMessageAt (desc)
  - `users`: displayName (asc) for search

## Security

- **Rules**: Only participants can read/write conversations & messages
- **Validation**: senderId must match request.auth.uid
- **Group creation**: Only campaign owner can create donor groups
- **Context validation**: Campaign data validated client-side before sending

## Support & Troubleshooting

### Common Issues

**"Failed to start conversation"**
- Check Firestore rules deployed
- Verify participants array contains both users
- Check console for permission-denied errors

**Images not loading**
- File too large (>500KB)
- Invalid image format
- Firestore doc size limit (1MB total)

**Voice messages fail**
- Microphone permission denied
- Recording too long (>30s)
- Browser doesn't support MediaRecorder

**Group creation fails**
- User not campaign owner
- No donors available
- Firestore rules not updated

### Debug Tips
1. Open browser DevTools Console
2. Check for "recordCampaignView failed:" or messaging errors
3. Verify Firestore rules in Firebase Console
4. Check network tab for failed writes
5. Ensure user is authenticated

---

**Version**: 1.0  
**Last Updated**: Nov 3, 2025  
**Author**: AI Assistant
