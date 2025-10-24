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

const Sidebar = () => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  const { open } = useSearch();
  const { currentUser, userProfile } = useAuth();
  const { isDarkMode } = useTheme();

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
      document.documentElement.style.setProperty('--sidebar-width', isHovered ? '16rem' : '5rem');
    }
  }, [isHovered]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', '5rem');
    }
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        onMouseEnter={() => {
          setIsHovered(true);
          if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--sidebar-width', '16rem');
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--sidebar-width', '5rem');
          }
        }}
        className={`hidden md:block fixed left-0 top-0 h-full border-r border-surface transition-all duration-300 ease-smooth z-50 ${
          isHovered ? 'w-64' : 'w-20'
        }`}
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--card-bg)'
        }}
      >
      {/* Header */}
  <div className="flex items-center justify-center h-[73px] border-b border-surface">
        <Link to="/" className="flex items-center space-x-2">
          {isHovered ? (
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
          className={`flex items-center ${isHovered ? 'space-x-3 justify-start' : 'justify-center'} px-4 py-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg font-medium`}
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
          title={!isHovered ? 'Create Campaign' : ''}
        >
          <AddCircleIcon className="flex-shrink-0" />
          {isHovered && (
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
              className={`flex items-center ${isHovered ? 'space-x-3' : 'justify-center'} px-4 py-3 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                active
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm'
                  : ''
              }`}
              title={!isHovered ? item.label : ''}
              onClick={(e)=>{ if(item.label === 'Search'){ e.preventDefault(); open(); } }}
              onMouseEnter={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseLeave={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text)'; } }}
            >
              <span className={`flex-shrink-0 transition-transform duration-300 ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                {item.icon}
              </span>
              {isHovered && (
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
          className={
            isHovered
              ? 'block rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 border shadow-sm'
              : 'flex items-center justify-center p-2'
          }
          style={
            isHovered
              ? {
                  backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                  borderColor: isDarkMode ? '#374151' : '#e5e7eb'
                }
              : {}
          }
          title={!isHovered ? 'Profile' : ''}
        >
          {/* Profile Header */}
          <div className={`flex items-center ${isHovered ? 'gap-3 mb-3' : 'justify-center'}`}>
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
            {isHovered && (
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
          {isHovered && (
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
