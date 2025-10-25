import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FacebookIcon from '@mui/icons-material/Facebook';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to log in: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError('Failed to log in with Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 animate-fade-in">
      <div className="w-full max-w-5xl animate-slide-in-up">
        <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl relative">
          {/* Back Button - Positioned on the card itself */}
          <button
            onClick={() => navigate('/welcome')}
            className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md z-10"
          >
            <ArrowBackIcon className="text-gray-700" />
          </button>

          <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Branding */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center items-center relative">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">G</span>
                  </div>
                  <h1 className="text-4xl font-bold text-gray-800 ml-2">fundreach</h1>
                </div>
                <p className="text-gray-600 text-lg mt-2">Description/Logo</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-gray-800"></div>

            {/* Right Side - Login Form */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center relative">
              <div className="max-w-md w-full mx-auto mt-8 md:mt-0">
                <h2 className="text-3xl font-bold text-gray-800 mb-8">Login</h2>

                {error && (
                  <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="input-focus-ring rounded-xl transition-all">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400 transition-all duration-300"
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <div className="relative input-focus-ring rounded-xl transition-all">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-20 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400 transition-all duration-300"
                      placeholder="Enter your password"
                      required
                    />
                    {/* Icon container is vertically centered and offset to avoid Edge's autofill/ellipsis control */}
                    <div className="absolute inset-y-0 right-6 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <VisibilityOffIcon fontSize="small" />
                        ) : (
                          <VisibilityIcon fontSize="small" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <Link to="/forgot-password" className="text-gray-600 text-sm hover:text-gray-800">
                      Forgot Password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </form>

                <div className="mt-8">
                  <p className="text-center text-gray-600 text-sm mb-4">Or Login with</p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => {/* Facebook login */}}
                      className="w-16 h-16 bg-white rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <FacebookIcon sx={{ fontSize: 32, color: '#1877F2' }} />
                    </button>
                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-16 h-16 bg-white rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <GoogleIcon sx={{ fontSize: 32, color: '#DB4437' }} />
                    </button>
                    <button
                      onClick={() => {/* Apple login */}}
                      className="w-16 h-16 bg-white rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <AppleIcon sx={{ fontSize: 32, color: '#000000' }} />
                    </button>
                  </div>
                </div>

                <p className="text-center text-gray-600 mt-8">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-cyan-500 font-medium hover:underline">
                    Register Now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
