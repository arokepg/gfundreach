# Inbox Management Feature Documentation

## Overview
The Inbox Management feature provides a smart filtering system for the Messages page, helping users organize conversations between friends and new contacts (strangers).

## Features

### 1. All Chats Tab
- **Purpose**: Displays all conversations the user participates in
- **Sorting**: By last message timestamp (most recent first)
- **Persistence**: Shows full conversation history, including old/read messages
- **Limit**: Loads up to 50 conversations

### 2. Unread Tab
- **Purpose**: Smart filter that shows conversations requiring attention
- **Displays TWO types of conversations**:
  1. **Unread Messages**: Conversations with unread messages (`unreadCount` > 0)
  2. **Stranger Conversations**: Messages from users NOT in your friend list (`isStranger: true`)

### Visual Indicators

#### Unread Messages
- Green border and background highlight
- Red pulsing dot in top-right corner
- Red badge showing unread count
- Bold text for name and message preview

#### Stranger Conversations
- Orange "New" badge next to the user's name
- Green border and background highlight (same as unread)
- Helps identify first-time contacts

#### Combined States
- A conversation can be BOTH unread AND from a stranger
- Both visual indicators will show simultaneously

## Technical Implementation

### Data Structure

#### Conversation Document (Firestore)
```javascript
{
  participants: ["userId1", "userId2"],
  participantNames: {
    userId1: "User Name 1",
    userId2: "User Name 2"
  },
  participantPhotos: {
    userId1: "photoURL1",
    userId2: "photoURL2"
  },
  lastMessage: "Last message content...",
  lastMessageAt: Timestamp,
  unreadCount: {
    userId1: 0,
    userId2: 3
  },
  createdAt: Timestamp,
  firstMessageSent: true
}
```

#### Client-Side Enhancement
The `isStranger` field is computed on the client by checking friendship status:
```javascript
{
  ...conversationData,
  isStranger: true, // Computed: other user NOT in friend list
}
```

### Key Functions

#### `subscribeToConversations` (messaging.js)
```javascript
export const subscribeToConversations = async (userId, callback) => {
  // 1. Fetch user's friend list
  const friendIds = await listFriendIds(userId);
  
  // 2. Subscribe to conversations
  return onSnapshot(query, async (snapshot) => {
    // 3. Check each conversation for stranger status
    const conversations = await Promise.all(snapshot.docs.map(async doc => {
      const otherUserId = data.participants?.find(id => id !== userId);
      const isStranger = otherUserId && !friendIds.includes(otherUserId);
      
      return {
        ...data,
        isStranger: isStranger
      };
    }));
    
    callback(conversations);
  });
};
```

#### Filter Logic (Messages.jsx)
```javascript
// Unread tab shows: unread messages OR stranger conversations
if (conversationFilter === 'unread') {
  const unreadCount = conv.unreadCount?.[currentUser.uid] || 0;
  const isStranger = conv.isStranger || false;
  return matchesSearch && (unreadCount > 0 || isStranger);
}
```

### Friend Status Integration

The feature integrates with the existing `friendships` collection:

**Friendship Document Structure**:
```javascript
{
  users: ["userId1", "userId2"], // Sorted array
  status: "accepted", // or "pending"
  requestedBy: "userId1",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Friend Check Process**:
1. Call `listFriendIds(userId)` to get all accepted friends
2. For each conversation, check if other participant is in the friend list
3. Set `isStranger: true` if NOT in friend list

## User Experience

### Workflow Example

#### Scenario 1: New User Messages You
1. You receive a message from someone not in your friend list
2. Conversation appears in "Unread" tab with orange "New" badge
3. Conversation has green border and highlight
4. When you open and read it, unread count goes to 0
5. BUT conversation stays in "Unread" tab because they're still a stranger
6. After you add them as a friend, conversation disappears from "Unread" tab

#### Scenario 2: Friend Messages You
1. You receive a message from an existing friend
2. Conversation appears in "Unread" tab (no "New" badge)
3. Has green border, red pulsing dot, and unread count
4. After reading, conversation disappears from "Unread" tab
5. Can still find it in "All Chats" tab

### Badge and Count Logic

#### Unread Tab Badge
Shows count of conversations that are:
- Unread (unreadCount > 0) OR
- From strangers (isStranger === true)

```javascript
const unreadConversationsCount = conversations.filter(conv => {
  const unreadCount = conv.unreadCount?.[currentUser.uid] || 0;
  const isStranger = conv.isStranger || false;
  return unreadCount > 0 || isStranger;
}).length;
```

## Performance Considerations

### Friend List Caching
- Friend list is fetched ONCE when subscribing to conversations
- Uses `await listFriendIds(userId)` before setting up snapshot listener
- Friend list updates require page refresh (acceptable tradeoff for performance)

### Query Limits
- Conversations query limited to 50 most recent
- Prevents performance issues with users who have many conversations
- Most recent conversations appear first (sorted by `lastMessageAt`)

### Real-Time Updates
- Uses Firestore `onSnapshot` for real-time conversation updates
- `isStranger` recalculated on each snapshot (using cached friend list)
- Unread counts update immediately when messages are sent/read

## Firestore Rules

No special rules needed for `isStranger` since it's computed client-side:

```javascript
match /conversations/{conversationId} {
  // Standard conversation rules apply
  allow read: if isConvParticipant();
  allow create: if isCreateValid();
  allow update: if isConvParticipant();
}
```

Rules for `friendships` collection enable the friend checking:
```javascript
match /friendships/{friendshipId} {
  allow read: if isSignedIn() && request.auth.uid in resource.data.users;
  allow create: if isSignedIn() && request.auth.uid in request.resource.data.users;
  allow update, delete: if isSignedIn() && request.auth.uid in resource.data.users;
}
```

## Testing Checklist

### Basic Functionality
- [ ] All Chats tab shows all conversations
- [ ] Unread tab shows unread conversations
- [ ] Unread tab shows stranger conversations
- [ ] Badge count matches filtered conversations
- [ ] Search works in both tabs

### Stranger Detection
- [ ] New conversation from non-friend shows orange "New" badge
- [ ] Stranger conversation appears in Unread tab
- [ ] After adding as friend, conversation leaves Unread tab (if read)
- [ ] Group conversations don't show "New" badge

### Visual Indicators
- [ ] Unread messages show red pulsing dot
- [ ] Unread messages show red badge with count
- [ ] Stranger conversations show orange "New" badge
- [ ] Green border appears for both unread and stranger
- [ ] Bold text applies correctly

### Edge Cases
- [ ] Conversation both unread AND stranger shows both indicators
- [ ] Reading a stranger's message keeps it in Unread tab
- [ ] Stranger becomes friend → conversation behavior updates
- [ ] Blocked/removed friend behavior (if implemented)

## Future Enhancements

### Potential Improvements
1. **Real-time Friend Updates**: Refresh friend list when friendships change
2. **Priority Sorting**: Sort strangers above read friend messages in Unread tab
3. **Stranger Actions**: Quick "Add Friend" or "Block" buttons in conversation
4. **Notification Sound**: Different sounds for friend vs stranger messages
5. **Read Receipts**: Show when stranger has read your message
6. **Auto-Archive**: Move old read stranger conversations to archive after X days

### Performance Optimizations
1. **Friend List Cache**: Store friend list in React Context to avoid repeated fetches
2. **Pagination**: Load conversations in batches (currently loads 50)
3. **Debounced Updates**: Throttle `isStranger` recalculation on rapid updates
4. **IndexedDB Cache**: Cache friend list locally for offline access

## Troubleshooting

### Issue: Strangers Not Appearing in Unread Tab
**Diagnosis**:
- Check `listFriendIds()` is working correctly
- Verify `isStranger` field is being set in `subscribeToConversations`
- Check browser console for errors

**Solution**:
```javascript
console.log('Friend IDs:', friendIds);
console.log('Other User ID:', otherUserId);
console.log('Is Stranger:', isStranger);
```

### Issue: Friend List Not Updating
**Diagnosis**:
- Friend list is cached when component mounts
- Changes to friendships require page refresh

**Solution**:
- Implement friend list refresh mechanism
- Or: Accept current behavior (refresh page to update)

### Issue: Performance Problems with Many Friends
**Diagnosis**:
- `listFriendIds()` queries all friendships
- Large friend lists can slow down initial load

**Solution**:
- Implement friend list pagination
- Cache friend list in localStorage/IndexedDB
- Use Firebase Auth custom claims for friend count limits

## Related Files

### Core Implementation
- `src/pages/user/Messages.jsx` - UI and filtering logic
- `src/utils/messaging.js` - Conversation subscription and stranger detection
- `src/utils/friends.js` - Friend list fetching

### Documentation
- `docs/FIRESTORE_RULES.md` - Security rules
- `docs/FEATURE_SUGGESTIONS.md` - Future enhancement ideas

## Conclusion

The Inbox Management feature provides intelligent conversation filtering by combining unread status with friendship status. This helps users prioritize important messages while staying aware of new contacts. The implementation balances functionality with performance through strategic caching and efficient queries.
