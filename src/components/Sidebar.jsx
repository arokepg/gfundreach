import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import { useSearch } from '../contexts/SearchContext';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
// no pin UI in hover-only mode

const Sidebar = () => {
  const [isHovered, setIsHovered] = useState(false);
  // Click-sticky prevents collapse flicker during navigation
  const [isClickSticky, setIsClickSticky] = useState(false);
  const [hoverTimer, setHoverTimer] = useState(null);
  const [clickTimer, setClickTimer] = useState(null);
  const location = useLocation();
  const { open } = useSearch();
  const { currentUser, userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const expanded = isHovered || isClickSticky;

  const menuItems = [
    { icon: <HomeIcon />, label: 'Home', path: '/' },
  { icon: <SearchIcon />, label: 'Search', path: '/explore' },
    { icon: <BookmarkIcon />, label: 'Saved', path: '/saved' },
    { icon: <GroupIcon />, label: 'Groups', path: '/groups' },
    { icon: <AccountBalanceWalletIcon />, label: 'Wallet', path: '/wallet' },
    { icon: <AccountCircleIcon />, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  // Keep CSS var in sync so other components (SearchSidebar) can offset correctly
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', expanded ? '16rem' : '5rem');
    }
  }, [expanded]);

  // On initial mount, set CSS var to collapsed width
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', '5rem');
    }
  }, []);

  const handleMouseEnter = () => {
    // Clear any existing timer
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    // Set a delay of 200ms before expanding
    const timer = setTimeout(() => {
      setIsHovered(true);
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--sidebar-width', '16rem');
      }
    }, 200);
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    // Clear any pending expansion
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    // Don't collapse if click-sticky is active
    if (isClickSticky) return;
    
    // Auto-collapse when not detecting hover
    setIsHovered(false);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', '5rem');
    }
  };

  // On mousedown before navigation, make it sticky briefly to avoid collapse flicker
  const handleItemMouseDown = () => {
    if (clickTimer) clearTimeout(clickTimer);
    setIsClickSticky(true);
    setIsHovered(true);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', '16rem');
    }
    const t = setTimeout(() => {
      setIsClickSticky(false);
      if (!isHovered && typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--sidebar-width', '5rem');
      }
    }, 1200);
    setClickTimer(t);
  };

  // Optionally extend stickiness a bit on click
  const handleItemClick = () => {
    if (clickTimer) clearTimeout(clickTimer);
    const t = setTimeout(() => {
      setIsClickSticky(false);
      if (!isHovered && typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--sidebar-width', '5rem');
      }
    }, 1500);
    setClickTimer(t);
  };

  const handleOutsideClick = () => {
    // Collapse when clicking outside
    setIsClickSticky(false);
    setIsHovered(false);
  };

  // Add click listener to detect clicks outside sidebar
  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.querySelector('[data-sidebar]');
      if ((isHovered || isClickSticky) && sidebar && !sidebar.contains(event.target)) {
        // If click-sticky active, ignore outside clicks
        if (isClickSticky) return;
        handleOutsideClick();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded, isHovered, isClickSticky]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, [hoverTimer, clickTimer]);

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        data-sidebar
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:block fixed left-0 top-0 h-full surface border-r border-surface transition-all duration-300 ease-in-out z-50 ${
          expanded ? 'w-64' : 'w-20'
        }`}
        style={{}}
      >
      {/* Header */}
      <div className="flex items-center justify-center h-[73px] border-b border-surface">
        <Link to="/" className="flex items-center space-x-2">
          {expanded ? (
            <span className="text-2xl font-bold whitespace-nowrap">
              <span className="text-green-600 dark:text-green-500">G</span>
              <span className="text-themed">fundreach</span>
            </span>
          ) : (
            <span className="text-2xl font-bold text-green-600 dark:text-green-500">G</span>
          )}
        </Link>
      </div>

      {/* Create Campaign Button */}
      <div className="p-4">
        <Link
          to="/create-post"
          onMouseDown={handleItemMouseDown}
          onClick={handleItemClick}
          className={`flex items-center ${expanded ? 'space-x-3 justify-start' : 'justify-center'} px-4 py-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg font-medium`}
          style={{
            backgroundColor: isDarkMode ? '#ffffff' : '#111827',
            color: isDarkMode ? '#111827' : '#ffffff'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? '#f3f4f6' : '#1f2937';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? '#ffffff' : '#111827';
          }}
          title={!expanded ? 'Create Campaign' : ''}
        >
          <AddCircleIcon className="flex-shrink-0" />
          {expanded && (
            <span className="whitespace-nowrap animate-fade-in">
              Create Campaign
            </span>
          )}
        </Link>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 pt-0 space-y-2">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.label === 'Search' ? '#' : item.path}
              className={`flex items-center ${expanded ? 'space-x-3' : 'justify-center'} px-4 py-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                active
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm'
                  : ''
              }`}
              title={!expanded ? item.label : ''}
              onMouseDown={handleItemMouseDown}
              onClick={(e)=>{ 
                if(item.label === 'Search'){ 
                  e.preventDefault(); 
                  open(); 
                } 
                handleItemClick();
              }}
              onMouseEnter={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseLeave={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text)'; } }}
            >
              <span className={`flex-shrink-0 transition-transform duration-300 ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                {item.icon}
              </span>
              {expanded && (
                <span className={`font-medium whitespace-nowrap animate-fade-in ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile Section at Bottom */}
      <div className="p-4 border-t border-surface">
        <Link
          to="/profile"
          onMouseDown={handleItemMouseDown}
          onClick={handleItemClick}
          className={
            expanded
              ? 'block rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 border shadow-sm'
              : 'flex items-center justify-center p-2'
          }
          style={
            expanded
              ? {
                  backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                  borderColor: isDarkMode ? '#374151' : '#e5e7eb'
                }
              : {}
          }
          title={!expanded ? 'Profile' : ''}
        >
          {/* Profile Header */}
          <div className={`flex items-center ${expanded ? 'gap-3 mb-3' : 'justify-center'}`}>
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {(userProfile?.photoURL || currentUser?.photoURL) ? (
                <img
                  src={userProfile?.photoURL || currentUser?.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <PersonIcon className="text-gray-400" sx={{ fontSize: 28 }} />
              )}
            </div>
            {expanded && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p 
                  className="text-sm font-bold truncate"
                  style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
                >
                  {userProfile?.displayName || currentUser?.displayName || 'User'}
                </p>
                <p 
                  className="text-xs truncate mt-0.5"
                  style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}
                >
                  {userProfile?.title || userProfile?.bio || ''}
                </p>
              </div>
            )}
          </div>

          {/* Stats - Only show when hovered */}
          {expanded && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span 
                  className="text-xs"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  Donated
                </span>
                <span 
                  className="text-sm font-semibold"
                  style={{ color: isDarkMode ? '#34d399' : '#059669' }}
                >
                  ${userProfile?.totalDonated || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span 
                  className="text-xs"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  Received
                </span>
                <span 
                  className="text-sm font-semibold"
                  style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}
                >
                  ${userProfile?.totalReceived || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span 
                  className="text-xs"
                  style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}
                >
                  Helped
                </span>
                <span 
                  className="text-sm font-semibold"
                  style={{ color: isDarkMode ? '#ffffff' : '#111827' }}
                >
                  {userProfile?.helpedPeople || 0} people
                </span>
              </div>
            </div>
          )}
        </Link>
      </div>
    </div>

    {/* Mobile Bottom Navigation */}
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 border-t border-surface z-50 safe-area-bottom"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--card-bg)'
      }}
    >
      <nav className="flex justify-around items-center px-2 py-3">
        {menuItems.slice(0, 5).map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.label === 'Search' ? '#' : item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
                active
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'text-themed-secondary'
              }`}
              onClick={(e)=>{ if(item.label === 'Search'){ e.preventDefault(); open(); } }}
            >
              <span className="transition-transform duration-300">
                {item.icon}
              </span>
              <span className={`text-xs font-medium ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
    </>
  );
};

export default Sidebar;
