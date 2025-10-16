import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const Sidebar = () => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  const menuItems = [
    { icon: <HomeIcon />, label: 'Home', path: '/' },
    { icon: <SearchIcon />, label: 'Search', path: '/explore' },
    { icon: <BookmarkIcon />, label: 'Saved', path: '/saved' },
    { icon: <GroupIcon />, label: 'Groups', path: '/groups' },
    { icon: <AccountBalanceWalletIcon />, label: 'Wallet', path: '/wallet' },
    { icon: <AccountCircleIcon />, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-0 h-full surface border-r border-surface transition-all duration-300 z-50 ${
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
              to={item.path}
              className={`flex items-center ${isHovered ? 'space-x-3' : 'justify-center'} px-4 py-3 rounded-xl transition-all ${
                active
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : ''
              }`}
              title={!isHovered ? item.label : ''}
              onMouseEnter={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseLeave={(e)=>{ if(!active){ e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text)'; } }}
            >
              <span className={`flex-shrink-0 ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                {item.icon}
              </span>
              {isHovered && (
                <span className={`font-medium whitespace-nowrap ${active ? 'text-green-700 dark:text-green-400' : ''}`}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
