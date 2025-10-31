import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import logo from '../../assets/logo.svg';
import NeuronBackground from '../../components/NeuronBackground';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err) {
      setError('Failed to send reset email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative"
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
      }}
    >
      <NeuronBackground />
      <div className="w-full max-w-5xl animate-slide-in-up relative" style={{ zIndex: 10 }}>
        <div className="rounded-3xl overflow-hidden shadow-2xl relative border border-white/30 bg-white/25 backdrop-blur-2xl">
          {/* Back Button - positioned on the card container for consistency */}
          <button
            onClick={() => navigate('/login')}
            className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md z-10"
          >
            <ArrowBackIcon className="text-gray-700" />
          </button>

          <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Left Side - Branding */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center items-center relative">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <img src={logo} alt="Gfundreach" className="w-10 h-10" />
                  <h1 className="text-4xl font-bold text-white ml-2">fundreach</h1>
                </div>
                <p className="text-white/90 text-lg mt-2">Reset your password</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-white/20 my-8 md:my-12"></div>

            {/* Right Side - Forgot Password Form */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative">
              <div className="max-w-md w-full mx-auto">
                <h2 className="text-3xl font-bold text-white mb-4 drop-shadow">Forgot Password?</h2>
                <p className="text-white/90 mb-8">
                  Don't worry! It occurs. Please enter the email address linked with your account.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                {success ? (
                  <div className="text-center">
                    <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-xl mb-4">
                      Password reset email sent! Please check your inbox.
                    </div>
                    <button
                      onClick={() => navigate('/login')}
                      className="text-emerald-200 font-medium hover:underline"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="input-focus-ring rounded-xl transition-all">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/70 backdrop-blur placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 transition-all duration-300"
                        placeholder="Enter your email"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {loading ? 'Sending...' : 'Send Code'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
