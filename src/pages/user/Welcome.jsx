import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.svg';
import { useEffect } from 'react';
import NeuronBackground from '../../components/NeuronBackground';

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
    <div
      className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative"
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
      }}
    >
      <NeuronBackground />
      <div className="w-full max-w-5xl animate-slide-in-up relative" style={{ zIndex: 10 }}>
        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/30 bg-white/25 backdrop-blur-2xl">
          <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Branding */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center items-center">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <img src={logo} alt="Gfundreach" className="w-14 h-14" />
                  <h1 className="text-5xl font-bold text-white ml-3 drop-shadow">fundreach</h1>
                </div>
                <p className="text-white/90 text-xl mt-4">Connect. Support. Transform.</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-white/20 my-8 md:my-12"></div>

            {/* Right Side - Action Buttons */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center items-center">
              <div className="w-full max-w-sm space-y-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-green-700 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  Login
                </button>
                
                <button
                  onClick={() => navigate('/register')}
                  className="w-full bg-white/80 backdrop-blur text-gray-900 py-4 rounded-xl text-lg font-semibold hover:bg-white transition-all duration-300 border-2 border-white/40 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
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
