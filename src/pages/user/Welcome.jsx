import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect } from 'react';

const Welcome = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-5xl">
        <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl">
          <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Branding */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center items-center">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-3xl font-bold">G</span>
                  </div>
                  <h1 className="text-5xl font-bold text-gray-800 ml-3">fundreach</h1>
                </div>
                <p className="text-gray-600 text-xl mt-4">Description/Logo</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-gray-800"></div>

            {/* Right Side - Action Buttons */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center items-center">
              <div className="w-full max-w-sm space-y-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-gray-800 text-white py-4 rounded-xl text-lg font-semibold hover:bg-gray-900 transition-colors shadow-md"
                >
                  Login
                </button>
                
                <button
                  onClick={() => navigate('/register')}
                  className="w-full bg-white text-gray-800 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-300 shadow-md"
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
