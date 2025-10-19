import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-5xl">
        <div className="bg-gray-200 rounded-3xl overflow-hidden shadow-xl">
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
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-gray-800"></div>

            {/* Right Side - Forgot Password Form */}
            <div className="md:w-1/2 bg-gray-200 p-8 md:p-12 flex flex-col justify-center relative">
              {/* Back Button */}
              <button
                onClick={() => navigate('/login')}
                className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-md"
              >
                <ArrowBackIcon className="text-gray-700" />
              </button>

              <div className="max-w-md w-full mx-auto">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Forgot Password?</h2>
                <p className="text-gray-600 mb-8">
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
                      className="text-cyan-500 font-medium hover:underline"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700 placeholder-gray-400"
                        placeholder="Enter your email"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
