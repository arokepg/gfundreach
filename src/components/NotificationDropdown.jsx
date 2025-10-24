import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatNotificationMessage, getTimeAgo } from '../utils/notifications';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CommentIcon from '@mui/icons-material/Comment';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { currentUser } = useAuth();
  
  const dropdownRef = useRef(null);

  // Fetch notifications from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
    }, (error) => {
      console.warn('Error fetching notifications:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
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
      case 'donation':
        return <VolunteerActivismIcon className="text-green-500" />;
      case 'like':
        return <FavoriteIcon className="text-red-500" />;
      case 'comment':
        return <CommentIcon className="text-blue-500" />;
      case 'follow':
        return <PersonAddIcon className="text-purple-500" />;
      default:
        return <NotificationsIcon className="text-gray-500" />;
    }
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

      {/* Dropdown */}
      {isOpen && (
  <div className="absolute right-0 mt-2 w-96 surface rounded-2xl shadow-xl border border-surface z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-surface flex items-center justify-between">
            <h3 className="text-lg font-bold text-themed">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-themed-muted">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-surface transition-colors cursor-pointer ${
                    !notification.read ? 'bg-green-50/50 dark:bg-green-900/10' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                  onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = !notification.read ? 'rgba(34,197,94,0.1)' : 'var(--hover-bg)'; }}
                  onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = !notification.read ? 'rgba(34,197,94,0.05)' : 'transparent'; }}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-themed">
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
                      className="flex-shrink-0 p-1 rounded-full transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <CloseIcon className="text-themed-muted text-sm" />
                    </button>

                    {/* Unread Indicator */}
                    {!notification.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-surface text-center">
              <button className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
