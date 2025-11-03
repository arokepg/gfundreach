# Testing Reactions - Quick Guide

## 🐛 Issues Fixed

### Problem
1. Khi click emoji, chat tự động scroll xuống bottom
2. Emoji picker không đóng sau khi click
3. Reactions không hiển thị trên tin nhắn

### Root Causes
1. **Auto-scroll**: `useEffect` trigger mỗi khi `messages` thay đổi (bao gồm cả reactions update)
2. **Picker not closing**: State không được clear trước khi async call
3. **Reactions not showing**: Firestore real-time update delay hoặc permission issues

### Solutions Applied

#### 1. Smart Auto-Scroll
```javascript
useEffect(() => {
  // Only scroll on NEW messages, not on reactions update
  const shouldScroll = !showEmojiPicker; // Don't scroll when picker is open
  if (shouldScroll) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [messages.length, showEmojiPicker]); // Depend on count, not full array
```

#### 2. Immediate Picker Close
```javascript
const handleReaction = async (messageId, emoji, e) => {
  if (e) e.stopPropagation();
  
  // Close picker FIRST (optimistic UI)
  setShowEmojiPicker(null);
  
  // Then do async update
  await addReaction(...);
};
```

#### 3. Click Outside Handler
```javascript
useEffect(() => {
  const handleClickOutside = (e) => {
    if (showEmojiPicker && !e.target.closest('.emoji-picker-wrapper')) {
      setShowEmojiPicker(null);
    }
  };
  document.addEventListener('click', handleClickOutside);
  return () => document.removeEventListener('click', handleClickOutside);
}, [showEmojiPicker]);
```

#### 4. Event Bubbling Prevention
- Added `e.stopPropagation()` to all click handlers
- Added `type="button"` to prevent form submission

## ✅ Testing Steps

### Test 1: Add Reaction
1. Mở một chat conversation có messages
2. **Hover** lên một message bubble
3. Smile icon xuất hiện ở góc trên bên phải
4. **Click** Smile icon
5. ✅ Emoji picker hiện ra (6 emojis)
6. ✅ Chat KHÔNG scroll xuống
7. **Click** một emoji (e.g., 👍)
8. ✅ Picker đóng ngay lập tức
9. ✅ Chat vẫn ở vị trí cũ
10. **Chờ 1-2 giây** cho Firestore update
11. ✅ Emoji hiện bên dưới message với count = 1

### Test 2: Remove Reaction
1. Từ message đã có reaction của bạn
2. **Click** vào emoji đó (ở dưới message)
3. ✅ Emoji biến mất (hoặc count giảm nếu nhiều người react)

### Test 3: Multiple Reactions
1. Add reaction 👍
2. Hover lại và add thêm ❤️
3. ✅ Cả 2 emojis hiện cùng lúc bên dưới message

### Test 4: Click Outside
1. Mở emoji picker
2. **Click** ra ngoài message bubble (anywhere else)
3. ✅ Picker đóng lại

### Test 5: Multiple Users
1. User A add reaction 👍 vào message của User B
2. User B refresh hoặc mở chat
3. ✅ User B thấy reaction từ User A
4. User B click 👍 để add reaction
5. ✅ Count tăng lên 2

## 🔍 Debug Console Logs

Khi click reaction, check browser console:

```
Reaction clicked: {messageId: "abc123", emoji: "👍", hasReacted: false, currentReactions: {}}
Adding reaction...
Reaction updated successfully
```

Nếu có lỗi:
```
Failed to toggle reaction Error: Missing or insufficient permissions
```
→ Check Firestore rules đã deploy chưa

## 🚨 Common Issues & Solutions

### Issue: Reactions không persist
**Symptom**: Emoji hiện rồi biến mất sau refresh
**Cause**: Firestore rules không cho phép update reactions field
**Solution**: 
```javascript
// In FIRESTORE_RULES.md, ensure this is deployed:
allow update: if isSignedIn() && (
  request.auth.uid == resource.data.senderId || (
    request.auth.uid in parentParticipants() &&
    request.resource.data.diff(resource.data).changedKeys().hasOnly(['reactions'])
  )
);
```

### Issue: Permission denied error
**Symptom**: Console error "Missing or insufficient permissions"
**Solution**:
1. Open Firebase Console
2. Go to Firestore → Rules
3. Copy rules from `docs/FIRESTORE_RULES.md`
4. Click **Publish**
5. Wait 30 seconds for propagation
6. Refresh page and test again

### Issue: Emoji picker không đóng
**Symptom**: Picker vẫn mở sau khi click emoji
**Cause**: Event propagation không dừng
**Solution**: Đã fix với `e.stopPropagation()`

### Issue: Chat scroll xuống khi react
**Symptom**: Scroll to bottom mỗi khi add/remove reaction
**Cause**: useEffect dependency vào toàn bộ messages array
**Solution**: Đã fix với `messages.length` dependency

## 📊 Expected Data Structure

### Message with Reactions
```javascript
{
  id: "msg123",
  senderId: "user1",
  content: "Hello!",
  reactions: {
    "👍": ["user2", "user3"],  // 2 người react
    "❤️": ["user2"]             // 1 người react
  },
  createdAt: Timestamp
}
```

### Display Logic
```javascript
{Object.entries(reactions).map(([emoji, userIds]) => {
  const count = userIds.length;
  const userReacted = userIds.includes(currentUser.uid);
  return (
    <button className={userReacted ? 'active' : ''}>
      {emoji} {count > 1 && count}
    </button>
  );
})}
```

## ✨ UX Improvements

1. **Optimistic UI**: Picker đóng ngay, không đợi Firestore
2. **No Scroll**: Reactions không trigger scroll
3. **Click Outside**: Dễ dàng đóng picker
4. **Hover State**: Smile icon chỉ hiện khi hover
5. **Visual Feedback**: Green border khi user đã react
6. **Count Display**: Hiện số người react nếu > 1

## 🎯 Next Steps

- [ ] Test với nhiều users (2+ accounts)
- [ ] Test trên mobile (touch events)
- [ ] Test với group chats (3+ members)
- [ ] Verify Firestore rules deployed
- [ ] Monitor console for errors
- [ ] Check performance với nhiều messages

## 📝 Firestore Rules Checklist

```bash
# Verify these rules are deployed:
✅ Conversations read/write by participants
✅ Messages create by participants
✅ Messages update for reactions field
✅ Group conversations support (>= 2 participants)
```

Copy full rules from `docs/FIRESTORE_RULES.md` và deploy!

---

**Test Status**: Ready to test 🚀
**Last Updated**: Nov 3, 2025
