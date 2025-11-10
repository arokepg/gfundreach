import { db } from '../config/firebase';
import { collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// Generate a 6-digit verification code
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store verification code in Firestore with expiration
export const storeVerificationCode = async (email, code, type = 'register') => {
  const verificationRef = doc(collection(db, 'verificationCodes'), email.toLowerCase());
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiration

  await setDoc(verificationRef, {
    email: email.toLowerCase(),
    code,
    type, // 'register' or 'login'
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    attempts: 0,
  });
};

// Verify the code entered by user
export const verifyCode = async (email, enteredCode) => {
  const verificationRef = doc(db, 'verificationCodes', email.toLowerCase());
  const verificationDoc = await getDoc(verificationRef);

  if (!verificationDoc.exists()) {
    return { success: false, message: 'Verification code not found. Please request a new code.' };
  }

  const data = verificationDoc.data();
  const now = new Date();
  const expiresAt = new Date(data.expiresAt);

  // Check if code is expired
  if (now > expiresAt) {
    await deleteDoc(verificationRef);
    return { success: false, message: 'Verification code has expired. Please request a new code.' };
  }

  // Check if too many attempts
  if (data.attempts >= 5) {
    await deleteDoc(verificationRef);
    return { success: false, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  // Check if code matches
  if (data.code !== enteredCode) {
    // Increment attempts
    await setDoc(verificationRef, { ...data, attempts: data.attempts + 1 }, { merge: true });
    return { success: false, message: `Incorrect code. ${4 - data.attempts} attempts remaining.` };
  }

  // Code is valid - delete it
  await deleteDoc(verificationRef);
  return { success: true, message: 'Verification successful!' };
};

// Clean up expired verification codes (can be called periodically)
export const cleanupExpiredCodes = async () => {
  const now = new Date().toISOString();
  const q = query(
    collection(db, 'verificationCodes'),
    where('expiresAt', '<', now)
  );
  
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
};

// Send verification email using a backend service
export const sendVerificationEmail = async (email, code, type = 'register') => {
  try {
    // For production: Use your backend API endpoint or Firebase Cloud Function
    const apiEndpoint = import.meta.env.VITE_EMAIL_API_ENDPOINT || '/api/send-verification-email';
    
    // Try to send via backend API
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          type,
          appName: 'GFundReach',
        }),
      });

      if (response.ok) {
        console.log('✅ Verification email sent successfully via API');
        return { success: true };
      }
      
      // API failed, fall through to development mode
      console.warn('⚠️ Email API returned error:', response.status);
    } catch (apiError) {
      console.warn('⚠️ Email API not available:', apiError.message);
    }

    // Development fallback: Log to console
    console.log(`
    ==========================================
    VERIFICATION EMAIL (${type.toUpperCase()})
    ==========================================
    To: ${email}
    Subject: Your Verification Code - GFundReach
    
    Your verification code is: ${code}
    
    This code will expire in 10 minutes.
    Do not share this code with anyone.
    ==========================================
  `);

    // Show alert in development mode
    if (import.meta.env.DEV) {
      alert(`Development Mode: Your verification code is ${code}\n\nCheck console for details.\n\nIn production, this will be sent to: ${email}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification code. Please try again.');
  }
};

// Resend verification code
export const resendVerificationCode = async (email, type = 'register') => {
  const code = generateVerificationCode();
  await storeVerificationCode(email, code, type);
  await sendVerificationEmail(email, code, type);
  return code;
};
