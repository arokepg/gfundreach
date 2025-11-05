import Sidebar from './Sidebar';
import NotificationDropdown from './NotificationDropdown';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SearchSidebar from './SearchSidebar';
import { useSearch } from '../contexts/SearchContext';
import logo from '../assets/logo.svg';
import MessageIcon from '@mui/icons-material/Message';
import { Link as RouterLink } from 'react-router-dom';

const Layout = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { open } = useSearch();
  const avatarUrl = userProfile?.photoURL || currentUser?.photoURL || null;

  return (
    <div className="min-h-screen transition-colors">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - Offset by sidebar on desktop, no offset on mobile */}
      <div className="md:pl-20 transition-all pb-20 md:pb-0">
        {/* Top Header */}
  <header className="surface border-b border-surface sticky top-0 z-40 h-[60px] md:h-[73px] flex items-center px-2 md:px-6">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto w-full">
            {/* Mobile Logo */}
            <div className="md:hidden shrink-0">
              <Link to="/" className="flex items-center gap-1.5">
                <img src={logo} alt="Gfundreach" className="w-5 h-5" />
                <span className="text-base font-bold text-themed">fundreach</span>
              </Link>
            </div>
            
            {/* Desktop empty space for alignment */}
            <div className="hidden md:block"></div>

            {/* Right Icons */}
            <div className="flex items-center gap-1 md:gap-4">
              {/* Mobile Messages Button */}
              <RouterLink
                to="/messages"
                className="md:hidden p-1.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 text-themed flex items-center justify-center h-9 w-9"
                title="Messages"
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
                style={{ backgroundColor: 'transparent' }}
                aria-label="Messages"
              >
                <MessageIcon sx={{ fontSize: 20 }} />
              </RouterLink>
              {/* Dark Mode Toggle */}
              <button
                className="p-1.5 md:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 text-themed flex items-center justify-center h-9 w-9 md:h-10 md:w-10"
                onClick={toggleTheme}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
                style={{ backgroundColor: 'transparent' }}
                aria-label="Toggle theme"
              >
                {isDarkMode ? <LightModeIcon sx={{ fontSize: 20 }} className="md:text-2xl" /> : <DarkModeIcon sx={{ fontSize: 20 }} className="md:text-2xl" />}
              </button>
              <button className="p-1.5 md:p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center h-9 w-9 md:h-10 md:w-10" style={{ backgroundColor: 'transparent' }}
                onClick={open}
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}
                aria-label="Open search"
              >
                <SearchIcon sx={{ fontSize: 20 }} className="text-themed-secondary md:text-2xl" />
              </button>
              <NotificationDropdown />
              <Link 
                to="/profile" 
                className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-110 active:scale-95 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <PersonIcon className="text-gray-600 dark:text-gray-300" sx={{ fontSize: 20 }} />
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Search Sidebar */}
        <SearchSidebar />

        {/* Page Content */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 page-transition">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
