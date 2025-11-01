import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import logo from '../assets/logo.svg';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

const Navbar = () => {
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="surface shadow-md sticky top-0 z-50 transition-all duration-300 border-b border-outline-variant">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img src={logo} alt="Gfundreach" className="w-7 h-7 transition-transform group-hover:scale-110" />
            <span className="text-2xl font-bold text-primary transition-all duration-300 group-hover:tracking-wide">fundreach</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/"
              className={isActive('/') ? 'nav-link-active' : 'nav-link'}
            >
              <HomeIcon className="mr-1" fontSize="small" />
              Home
            </Link>
            <Link
              to="/wallet"
              className={isActive('/wallet') ? 'nav-link-active' : 'nav-link'}
            >
              <AccountBalanceWalletIcon className="mr-1" fontSize="small" />
              Wallet
            </Link>
            <Link
              to="/profile"
              className={isActive('/profile') ? 'nav-link-active' : 'nav-link'}
            >
              <PersonIcon className="mr-1" fontSize="small" />
              Profile
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <Link to="/create-post" className="btn-primary flex items-center gap-2">
              <AddCircleIcon fontSize="small" />
              <span className="hidden sm:inline">Create Campaign</span>
            </Link>
            
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 text-themed hover:bg-(--hover-bg)"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </button>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 text-themed hover:text-error hover:bg-error-50 dark:hover:bg-red-900/20"
              title="Logout"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-around py-2 border-t border-outline-variant">
          <Link
            to="/"
            className={`flex flex-col items-center transition-all duration-300 hover:scale-110 ${
              isActive('/') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <HomeIcon />
            <span className="text-xs">Home</span>
          </Link>
          <Link
            to="/wallet"
            className={`flex flex-col items-center transition-all duration-300 hover:scale-110 ${
              isActive('/wallet') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <AccountBalanceWalletIcon />
            <span className="text-xs">Wallet</span>
          </Link>
          <Link
            to="/profile"
            className={`flex flex-col items-center transition-all duration-300 hover:scale-110 ${
              isActive('/profile') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <PersonIcon />
            <span className="text-xs">Profile</span>
          </Link>
          {/* Dark Mode Toggle (Mobile) */}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center text-themed transition-all duration-300 hover:scale-110 active:scale-95"
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
            <span className="text-xs">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
