import { useState, useEffect, useRef } from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CommentIcon from '@mui/icons-material/Comment';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'donation',
      message: 'John Doe donated $50 to your post',
      time: '2 hours ago',
      read: false,
      icon: <VolunteerActivismIcon className="text-green-500" />
    },
    {
      id: 2,
      type: 'like',
      message: 'Sarah liked your post "Help needed for medical bills"',
      time: '5 hours ago',
      read: false,
      icon: <FavoriteIcon className="text-red-500" />
    },
    {
      id: 3,
      type: 'comment',
      message: 'Mike commented on your post',
      time: '1 day ago',
      read: true,
      icon: <CommentIcon className="text-blue-500" />
    },
    {
      id: 4,
      type: 'follow',
      message: 'Emma started following you',
      time: '2 days ago',
      read: true,
      icon: <PersonAddIcon className="text-purple-500" />
    }
  ]);
  
  const dropdownRef = useRef(null);

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

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
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
        <NotificationsIcon className="text-gray-700 dark:text-gray-300" />
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
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
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
                      {notification.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {notification.time}
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
                      <CloseIcon className="text-gray-400 dark:text-gray-500 text-sm" />
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
