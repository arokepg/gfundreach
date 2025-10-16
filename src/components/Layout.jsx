import Sidebar from './Sidebar';
import NotificationDropdown from './NotificationDropdown';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';

const Layout = ({ children }) => {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen transition-colors">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - Offset by sidebar (always use collapsed width) */}
      <div className="pl-20 transition-all">
        {/* Top Header */}
  <header className="surface border-b border-surface sticky top-0 z-40 h-[73px] flex items-center px-6">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto w-full">
            {/* Empty space for alignment */}
            <div></div>

            {/* Right Icons */}
            <div className="flex items-center gap-4">
              <NotificationDropdown />
              <button className="p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor = 'var(--hover-bg)'; }}
                onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <ChatIcon className="text-gray-700 dark:text-gray-300" />
              </button>
              <Link 
                to="/profile" 
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
              >
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <PersonIcon className="text-gray-600 dark:text-gray-300" />
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
