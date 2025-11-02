# Direct Messaging (DM) System

## Overview

The Direct Messaging system allows potential donors to send private messages to campaign creators to ask questions before donating. This builds trust and enables transparent communication.

## Architecture

### Database Structure

```
conversations/
  {conversationId}/
    participants: [userId1, userId2]
    participantNames: { userId1: "Name1", userId2: "Name2" }
    lastMessage: "Preview text..."
    lastMessageAt: timestamp
    unreadCount: { userId1: 0, userId2: 1 }
    createdAt: timestamp
    
    messages/ (subcollection)
      {messageId}/
        senderId: string
        senderName: string
        content: string
        createdAt: timestamp
        read: boolean
```

### Conversation ID Convention

Format: `{smaller_uid}_{larger_uid}`

This ensures a consistent conversation ID regardless of who initiates the chat.

## Frontend Components

### 1. Messaging Button Component
Location: `src/components/MessageButton.jsx`

```jsx
// Shows on campaign detail pages
// Opens messaging modal or navigates to conversations page
```

### 2. Conversations List
Location: `src/pages/user/Messages.jsx`

- Lists all conversations for current user
- Shows unread count badges
- Displays last message preview
- Real-time updates with Firestore listeners

### 3. Chat Interface
Location: `src/components/ChatBox.jsx`

- Full-screen or modal view
- Real-time message updates
- Message input with send button
- Auto-scrolls to latest message
- Marks messages as read when opened

## Implementation Steps

### Step 1: Firestore Security Rules

Add to `FIRESTORE_RULES.md`:

```javascript
// Conversations
match /conversations/{conversationId} {
  // Users can only read conversations they're part of
  allow read: if isSignedIn() && 
    request.auth.uid in resource.data.participants;
  
  // Users can create conversations if they're one of the participants
  allow create: if isSignedIn() && 
    request.auth.uid in request.resource.data.participants &&
    request.resource.data.participants.size() == 2;
  
  // Participants can update last message and unread counts
  allow update: if isSignedIn() && 
    request.auth.uid in resource.data.participants;
  
  // Messages subcollection
  match /messages/{messageId} {
    // Participants can read all messages
    allow read: if isSignedIn() && 
      request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    
    // Participants can send messages
    allow create: if isSignedIn() && 
      request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants &&
      request.auth.uid == request.resource.data.senderId;
    
    // Sender can update their own messages (e.g., mark as read)
    allow update: if isSignedIn() && 
      request.auth.uid == resource.data.senderId;
  }
}
```

### Step 2: Utility Functions

Create `src/utils/messaging.js`:

```javascript
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Generate conversation ID from two user IDs
export const getConversationId = (uid1, uid2) => {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

// Get or create a conversation
export const getOrCreateConversation = async (currentUserId, otherUserId, currentUserName, otherUserName) => {
  const convId = getConversationId(currentUserId, otherUserId);
  const convRef = doc(db, 'conversations', convId);
  const convSnap = await getDoc(convRef);
  
  if (!convSnap.exists()) {
    // Create new conversation
    await setDoc(convRef, {
      participants: [currentUserId, otherUserId],
      participantNames: {
        [currentUserId]: currentUserName,
        [otherUserId]: otherUserName
      },
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      unreadCount: {
        [currentUserId]: 0,
        [otherUserId]: 0
      },
      createdAt: serverTimestamp()
    });
  }
  
  return convId;
};

// Send a message
export const sendMessage = async (conversationId, senderId, senderName, content) => {
  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(convRef, 'messages');
  
  // Add message to subcollection
  await addDoc(messagesRef, {
    senderId,
    senderName,
    content,
    read: false,
    createdAt: serverTimestamp()
  });
  
  // Update conversation metadata
  const convSnap = await getDoc(convRef);
  const participants = convSnap.data().participants;
  const otherUserId = participants.find(id => id !== senderId);
  
  await updateDoc(convRef, {
    lastMessage: content.substring(0, 100),
    lastMessageAt: serverTimestamp(),
    [`unreadCount.${otherUserId}`]: increment(1)
  });
};

// Mark conversation as read
export const markConversationAsRead = async (conversationId, userId) => {
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, {
    [`unreadCount.${userId}`]: 0
  });
};

// Subscribe to messages (real-time)
export const subscribeToMessages = (conversationId, callback) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

// Subscribe to conversations list (real-time)
export const subscribeToConversations = (userId, callback) => {
  const convRef = collection(db, 'conversations');
  const q = query(
    convRef,
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(conversations);
  });
};
```

### Step 3: UI Components

#### Message Button (Campaign Detail)

```jsx
import { useState } from 'react';
import { MessageIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getOrCreateConversation } from '../utils/messaging';

export const MessageButton = ({ campaignCreatorId, campaignCreatorName }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleMessage = async () => {
    if (!currentUser) {
      alert('Please log in to send messages');
      return;
    }
    
    if (currentUser.uid === campaignCreatorId) {
      alert("You can't message yourself");
      return;
    }

    setLoading(true);
    try {
      const convId = await getOrCreateConversation(
        currentUser.uid,
        campaignCreatorId,
        userProfile?.displayName || currentUser.displayName || 'User',
        campaignCreatorName
      );
      navigate(`/messages/${convId}`);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleMessage}
      disabled={loading}
      className="btn-outline flex items-center gap-2"
    >
      <MessageIcon fontSize="small" />
      {loading ? 'Loading...' : 'Message Creator'}
    </button>
  );
};
```

#### Conversations List Page

```jsx
// src/pages/user/Messages.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToConversations } from '../../utils/messaging';
import Layout from '../../components/Layout';
import { Link } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';

export default function Messages() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = subscribeToConversations(currentUser.uid, (convs) => {
      setConversations(convs);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-themed mb-6">Messages</h1>
        
        {conversations.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-themed-muted">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const otherUserId = conv.participants.find(id => id !== currentUser.uid);
              const otherUserName = conv.participantNames[otherUserId];
              const unreadCount = conv.unreadCount?.[currentUser.uid] || 0;
              
              return (
                <Link
                  key={conv.id}
                  to={`/messages/${conv.id}`}
                  className="card p-4 hover:shadow-md transition-shadow flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <PersonIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-themed">{otherUserName}</p>
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-themed-muted truncate">{conv.lastMessage}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
```

## Testing Checklist

- [ ] User can click "Message Creator" on campaign detail page
- [ ] Conversation is created with correct participants
- [ ] Messages send in real-time
- [ ] Unread count updates correctly
- [ ] Conversation list sorts by most recent
- [ ] Mobile responsive layout
- [ ] Security rules prevent unauthorized access

## Future Enhancements

1. **Rich Text**: Add emoji picker and basic formatting
2. **Image Sharing**: Allow sending images in messages
3. **Typing Indicators**: Show when the other person is typing
4. **Message Notifications**: Push notifications for new messages
5. **Block/Report**: Allow users to block or report conversations
6. **Message Search**: Search within conversation history
7. **Group Messaging**: Extend to support team campaigns

## Performance Considerations

- Use Firestore `limit()` to paginate old messages
- Implement virtual scrolling for large conversation histories
- Cache conversation metadata in React Query
- Use `onSnapshot` strategically (only for active conversations)
- Consider using Cloud Functions to send email/push notifications

## Privacy & Safety

- Users can only see conversations they're part of
- No global "browse all messages" feature
- Consider adding:
  - Report abuse button
  - Block user feature
  - Message moderation for flagged accounts
  - Auto-delete old conversations (90+ days inactive)
