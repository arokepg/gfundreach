import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
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
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary rounded-full p-2">
              <VolunteerActivismIcon sx={{ color: 'white', fontSize: 24 }} />
            </div>
            <span className="text-2xl font-bold text-primary">Gfundreach</span>
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
          <div className="flex items-center gap-3">
            <Link to="/create-post" className="btn-primary flex items-center gap-2">
              <AddCircleIcon fontSize="small" />
              <span className="hidden sm:inline">Create Post</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-error hover:bg-error-50 p-2 rounded-lg transition-colors"
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
            className={`flex flex-col items-center ${
              isActive('/') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <HomeIcon />
            <span className="text-xs">Home</span>
          </Link>
          <Link
            to="/wallet"
            className={`flex flex-col items-center ${
              isActive('/wallet') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <AccountBalanceWalletIcon />
            <span className="text-xs">Wallet</span>
          </Link>
          <Link
            to="/profile"
            className={`flex flex-col items-center ${
              isActive('/profile') ? 'text-primary' : 'text-gray-600'
            }`}
          >
            <PersonIcon />
            <span className="text-xs">Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
