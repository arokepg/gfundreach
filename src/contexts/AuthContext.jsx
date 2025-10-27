/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const authErrorMessage = (error) => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email format. Please check and try again.';
      case 'auth/missing-password':
        return 'Please enter your password.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/popup-closed-by-user':
        return 'The sign-in popup was closed before completing. Please try again.';
      default:
        return error?.message || 'Authentication failed. Please try again.';
    }
  };

  // Signup with email and password
  const signup = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const defaultDisplayName = displayName || email || 'User';
    await updateProfile(result.user, { displayName: defaultDisplayName });
    
    // Create user profile in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email,
      displayName: defaultDisplayName,
      photoURL: result.user.photoURL || '',
      emailLower: (email || '').toLowerCase(),
      displayNameLower: (defaultDisplayName || '').toLowerCase(),
      bio: '',
      walletBalance: 0,
      totalDonated: 0,
      totalReceived: 0,
      createdAt: new Date().toISOString(),
    });
    
    return result;
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {/* ignore persistence errors */}
    try {
      return await signInWithEmailAndPassword(auth, (email || '').trim(), password);
    } catch (err) {
      const msg = authErrorMessage(err);
      const wrapped = new Error(msg);
      wrapped.code = err.code;
      throw wrapped;
    }
  };

  // Login with Google
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {/* ignore */}
    const result = await signInWithPopup(auth, provider).catch((err) => {
      const msg = authErrorMessage(err);
      const wrapped = new Error(msg);
      wrapped.code = err.code;
      throw wrapped;
    });
    const defaultDisplayName = result.user.displayName || result.user.email || 'User';
    // Ensure auth profile has a displayName so UI can show it
    if (!result.user.displayName && defaultDisplayName) {
      try { 
        await updateProfile(result.user, { displayName: defaultDisplayName }); 
      } catch (err) {
        console.warn('Failed to update profile displayName:', err);
      }
    }
    
    // Check if user profile exists, if not create one
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: defaultDisplayName,
        photoURL: result.user.photoURL || '',
        emailLower: (result.user.email || '').toLowerCase(),
        displayNameLower: (defaultDisplayName || '').toLowerCase(),
        bio: '',
        walletBalance: 0,
        totalDonated: 0,
        totalReceived: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      // Update photoURL if it exists in Google account but not in Firestore
      const userData = userDoc.data();
      const updates = { ...userData };
      if (result.user.photoURL && userData.photoURL !== result.user.photoURL) {
        updates.photoURL = result.user.photoURL;
      }
      if (!userData.displayName) {
        updates.displayName = defaultDisplayName;
        updates.displayNameLower = (defaultDisplayName || '').toLowerCase();
      }
      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, 'users', result.user.uid), updates, { merge: true });
      }
    }
    
    return result;
  };

  // Logout
  const logout = () => {
    return signOut(auth);
  };

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      setUserProfile(userDoc.data());
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Ensure displayName is at least the email by default
        if (!user.displayName && user.email) {
          try { 
            await updateProfile(user, { displayName: user.email }); 
          } catch (err) {
            console.warn('Failed to update user displayName:', err);
          }
        }
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    loginWithGoogle,
    logout,
    fetchUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
