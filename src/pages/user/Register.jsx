import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import logo from '../../assets/logo.svg';
import FacebookIcon from '@mui/icons-material/Facebook';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';
import NeuronBackground from '../../components/NeuronBackground';
import { generateVerificationCode, storeVerificationCode, sendVerificationEmail, verifyCode, resendVerificationCode } from '../../utils/emailVerification';

const Register = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [resendLoading, setResendLoading] = useState(false);
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
      
      // Generate and send verification code
      const code = generateVerificationCode();
      await storeVerificationCode(formData.email, code, 'register');
      await sendVerificationEmail(formData.email, code, 'register');
      
      // Show verification screen
      setShowVerification(true);
    } catch (err) {
      setError('Failed to send verification code: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationInput = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerificationKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    const code = verificationCode.join('');

    if (code.length !== 6) {
      return setError('Please enter the complete 6-digit code');
    }

    try {
      setError('');
      setLoading(true);

      // Verify the code
      const result = await verifyCode(formData.email, code);
      
      if (!result.success) {
        setError(result.message);
        setLoading(false);
        return;
      }

      // Code verified - now create the account
      await signup(formData.email, formData.password, formData.displayName);
      navigate('/');
    } catch (err) {
      setError('Failed to create account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setResendLoading(true);
      setError('');
      await resendVerificationCode(formData.email, 'register');
      setVerificationCode(['', '', '', '', '', '']);
      alert('A new verification code has been sent to your email.');
    } catch (err) {
      setError('Failed to resend code: ' + err.message);
    } finally {
      setResendLoading(false);
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
    <div
      className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative"
      style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
      }}
    >
      <NeuronBackground />
      <div className="w-full max-w-5xl animate-slide-in-up relative" style={{ zIndex: 10 }}>
        <div className="rounded-3xl overflow-hidden shadow-2xl relative border border-white/30 bg-white/25 backdrop-blur-2xl">
          {/* Back Button - Positioned on the card itself */}
          <button
            onClick={() => navigate('/welcome')}
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
                <p className="text-white/90 text-2xl font-bold mt-8 drop-shadow">Welcome! Join</p>
                <p className="text-white/90 text-2xl font-bold drop-shadow">our community today!</p>
                
                <div className="mt-8">
                  <p className="text-white/90 text-sm mb-4">Or Register with</p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => {/* Facebook login */}}
                      className="w-16 h-16 bg-green-50/90 backdrop-blur rounded-xl flex items-center justify-center hover:bg-green-100 transition-colors shadow-sm border border-green-200/50"
                    >
                      <FacebookIcon sx={{ fontSize: 32, color: '#1877F2' }} />
                    </button>
                    <button 
                      onClick={handleGoogleSignup}
                      disabled={loading}
                      className="w-16 h-16 bg-green-50/90 backdrop-blur rounded-xl flex items-center justify-center hover:bg-green-100 transition-colors shadow-sm disabled:opacity-50 border border-green-200/50"
                    >
                      <GoogleIcon sx={{ fontSize: 32, color: '#DB4437' }} />
                    </button>
                    <button 
                      onClick={() => {/* Apple login */}}
                      className="w-16 h-16 bg-green-50/90 backdrop-blur rounded-xl flex items-center justify-center hover:bg-green-100 transition-colors shadow-sm border border-green-200/50"
                    >
                      <AppleIcon sx={{ fontSize: 32, color: '#000000' }} />
                    </button>
                  </div>
                </div>

                <p className="text-center text-white/90 mt-6 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-emerald-200 font-medium hover:underline">
                    Login Now
                  </Link>
                </p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden md:block w-px bg-white/20 my-8 md:my-12"></div>

            {/* Right Side - Register Form */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center relative">
              <div className="max-w-md w-full mx-auto mt-8 md:mt-0">
                <h2 className="text-3xl font-bold text-white mb-8 drop-shadow">
                  {showVerification ? 'Verify Your Email' : 'Register'}
                </h2>

                {error && (
                  <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                {!showVerification ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="input-focus-ring rounded-xl transition-all">
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/70 backdrop-blur placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 transition-all duration-300"
                      placeholder="Username"
                      required
                    />
                  </div>

                  <div className="input-focus-ring rounded-xl transition-all">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/70 backdrop-blur placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 transition-all duration-300"
                      placeholder="Email"
                      required
                    />
                  </div>

                  <div className="input-focus-ring rounded-xl transition-all">
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/70 backdrop-blur placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 transition-all duration-300"
                      placeholder="Password"
                      required
                    />
                  </div>

                  <div className="input-focus-ring rounded-xl transition-all">
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-white/30 bg-white/70 backdrop-blur placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-400 text-gray-900 transition-all duration-300"
                      placeholder="Confirm password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {loading ? 'Sending Code...' : 'Agree and Register'}
                  </button>
                </form>
                ) : (
                  // Verification Code Screen
                  <form onSubmit={handleVerificationSubmit} className="space-y-6">
                    <div className="text-center mb-6">
                      <p className="text-white/90 text-sm">
                        We've sent a 6-digit verification code to
                      </p>
                      <p className="text-white font-semibold mt-1">{formData.email}</p>
                    </div>

                    {/* 6-digit Code Input */}
                    <div className="flex justify-center gap-2">
                      {verificationCode.map((digit, index) => (
                        <input
                          key={index}
                          id={`code-input-${index}`}
                          type="text"
                          maxLength="1"
                          value={digit}
                          onChange={(e) => handleVerificationInput(index, e.target.value)}
                          onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                          className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-white/30 bg-white/70 backdrop-blur focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 text-gray-900 transition-all"
                          required
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {loading ? 'Verifying...' : 'Verify & Create Account'}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendLoading}
                        className="text-white/90 text-sm hover:text-white hover:underline disabled:opacity-50"
                      >
                        {resendLoading ? 'Sending...' : 'Didn\'t receive code? Resend'}
                      </button>
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowVerification(false);
                          setVerificationCode(['', '', '', '', '', '']);
                          setError('');
                        }}
                        className="text-white/90 text-sm hover:text-white hover:underline"
                      >
                        Back to Registration
                      </button>
                    </div>
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

export default Register;
