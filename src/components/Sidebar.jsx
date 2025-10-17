import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import { useSearch } from '../contexts/SearchContext';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const Sidebar = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { open } = useSearch();

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
        className={`hidden md:block fixed left-0 top-0 h-full surface border-r border-surface transition-all duration-300 ease-smooth z-50 ${
          isHovered ? 'w-64' : 'w-20'
        }`}
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

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2">
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
    </div>

    {/* Mobile Bottom Navigation */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 surface border-t border-surface z-50 safe-area-bottom">
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
