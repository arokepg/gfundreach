import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FacebookIcon from '@mui/icons-material/Facebook';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';

const Register = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setError('');
      setLoading(true);
      await signup(formData.email, formData.password, formData.displayName);
      navigate('/');
    } catch (err) {
      setError('Failed to create an account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError('Failed to sign up with Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-5xl">
        <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl relative">
          {/* Back Button - Positioned on the card itself */}
          <button
            onClick={() => navigate('/welcome')}
            className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-md z-10"
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
                <p className="text-gray-800 text-2xl font-bold mt-8">Welcome back! Glad</p>
                <p className="text-gray-800 text-2xl font-bold">to see you, Again!</p>
                
                <div className="mt-8">
                  <p className="text-gray-600 text-sm mb-4">Or Login with</p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => {/* Facebook login */}}
                      className="w-16 h-16 bg-white rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <FacebookIcon sx={{ fontSize: 32, color: '#1877F2' }} />
                    </button>
                    <button 
                      onClick={handleGoogleSignup}
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

                <p className="text-center text-gray-600 mt-6 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-cyan-500 font-medium hover:underline">
                    Login Now
                  </Link>
                </p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-gray-800"></div>

            {/* Right Side - Register Form */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center relative">
              <div className="max-w-md w-full mx-auto mt-8 md:mt-0">
                {error && (
                  <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400"
                      placeholder="Username"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400"
                      placeholder="Email"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400"
                      placeholder="Password"
                      required
                    />
                  </div>

                  <div>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400"
                      placeholder="Confirm password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Agree and Register'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
