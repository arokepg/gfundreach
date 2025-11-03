import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatNotificationMessage, getTimeAgo } from '../utils/notifications';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CommentIcon from '@mui/icons-material/Comment';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ShareIcon from '@mui/icons-material/Share';
import ArticleIcon from '@mui/icons-material/Article';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { currentUser } = useAuth();
  
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Handle smooth close animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 250); // Match animation duration
  };

  // Subscribe to notifications in real-time whenever user is logged in
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsub = () => {};
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    try {
      // Prefer realtime when index is available and SDK is stable
      unsub = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setNotifications(notifs);
      }, async (error) => {
        console.warn('Realtime notifications failed, falling back to one-time fetch:', error);
        try {
          const snap = await getDocs(q);
          const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setNotifications(notifs);
        } catch (err) {
          console.warn('Fallback one-time notifications fetch also failed:', err);
        }
      });
    } catch (e) {
      console.warn('Subscription setup failed, using one-time fetch', e);
      (async () => {
        try {
          const snap = await getDocs(q);
          const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setNotifications(notifs);
        } catch (err) {
          console.warn('One-time notifications fetch failed:', err);
        }
      })();
    }

    return () => {
      try { unsub(); } catch { /* noop */ }
    };
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true
      });
    } catch (error) {
      console.warn('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updatePromises = notifications
        .filter(n => !n.read)
        .map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
      await Promise.all(updatePromises);
    } catch (error) {
      console.warn('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.warn('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'chat_mention':
        return <CommentIcon className="text-purple-600" />;
      case 'donation':
        return <VolunteerActivismIcon className="text-green-500" />;
      case 'donation_receipt':
        return <ReceiptLongIcon className="text-green-500" />;
      case 'like':
      case 'like_grouped':
        return <FavoriteIcon className="text-red-500" />;
      case 'share':
        return <ShareIcon className="text-green-500" />;
      case 'comment':
        return <CommentIcon className="text-blue-500" />;
      case 'community_post':
        return <ArticleIcon className="text-blue-500" />;
      case 'group_campaign_created':
      case 'group_post_created':
        return <ArticleIcon className="text-purple-600" />;
      case 'group_member_joined':
      case 'group_join_success':
      case 'group_leave_success':
      case 'group_kicked':
        return <PersonAddIcon className="text-purple-600" />;
      case 'follow':
        return <PersonAddIcon className="text-green-500" />;
      case 'friend_request':
        return <PersonAddIcon className="text-blue-500" />;
      default:
        return <NotificationsIcon className="text-gray-500" />;
    }
  };

  // When panel opens, mark all as read
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unreadCount]);

  const routeForNotification = (n) => {
    const postId = n.postId || n.campaignId;
    const groupId = n.groupId;
    const senderId = n.senderId;
    const conversationId = n.conversationId;

    switch (n.type) {
      case 'chat_mention':
        return conversationId ? `/messages/${conversationId}` : null;
      case 'donation':
      case 'donation_receipt':
      case 'comment':
      case 'community_post':
      case 'like':
      case 'like_grouped':
      case 'share':
      case 'share_grouped':
      case 'campaign_update':
        return postId ? `/post/${postId}` : null;
      case 'group_campaign_created':
        return (n.campaignId ? `/post/${n.campaignId}` : (groupId ? `/group/${groupId}` : null));
      case 'group_post_created':
      case 'group_join_success':
      case 'group_leave_success':
      case 'group_kicked':
      case 'group_member_joined':
        return groupId ? `/group/${groupId}` : null;
      case 'follow':
      case 'friend_accepted':
        return senderId ? `/profile/${senderId}` : '/profile';
      case 'friend_request':
        return '/profile'; // handled specially to open requests
      default:
        return null;
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      await markAsRead(notification.id);
    } catch {
      // ignore
    }

    // Close dropdown before navigating
    setIsOpen(false);

    // Friend request: open profile requests sub-tab
    if (notification.type === 'friend_request') {
      navigate('/profile', { state: { friendsSubTab: 'requests' } });
      return;
    }

    const route = routeForNotification(notification);
    if (route) navigate(route);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full transition-colors relative"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <NotificationsIcon sx={{ fontSize: 24 }} className="text-themed-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - Full screen on mobile, dropdown on desktop */}
      {isOpen && (
        <>
          {/* Mobile overlay */}
          <div 
            className={`lg:hidden fixed inset-0 bg-black/50 z-50 ${isClosing ? 'overlay-exit' : 'overlay-enter'}`}
            onClick={handleClose} 
          />
          
          {/* Notification panel */}
          <div className={`fixed lg:absolute inset-0 lg:inset-auto lg:right-0 lg:top-full lg:mt-2 lg:w-96 surface lg:rounded-2xl shadow-xl border-0 lg:border border-surface z-50 overflow-hidden flex flex-col lg:max-h-[600px] ${isClosing ? 'notif-panel-exit lg:notif-dropdown-exit' : 'notif-panel-enter lg:notif-dropdown-enter'}`}>
            {/* Header */}
            <div className="px-4 py-4 lg:py-3 border-b border-surface flex items-center justify-between shrink-0">
              <h3 className="text-xl lg:text-lg font-bold text-themed">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="lg:hidden p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 lg:py-8 text-center text-themed-muted">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-4 lg:py-3 border-b border-surface transition-colors cursor-pointer ${
                    !notification.read ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = !notification.read ? 'rgba(34,197,94,0.1)' : 'var(--hover-bg)'; }}
                  onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = !notification.read ? 'rgba(34,197,94,0.05)' : 'transparent'; }}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm lg:text-sm text-themed">
                        {formatNotificationMessage(notification)}
                      </p>
                      <p className="text-xs text-themed-muted mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="shrink-0 p-2 lg:p-1 rounded-full transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <CloseIcon className="text-themed-muted text-base lg:text-sm" />
                    </button>

                    {/* Unread Indicator */}
                    {!notification.read && (
                      <div className="shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-4 lg:py-3 border-t border-surface text-center shrink-0">
              <button className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default NotificationDropdown;
