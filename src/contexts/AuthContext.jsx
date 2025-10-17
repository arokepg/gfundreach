import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
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

  // Signup with email and password
  const signup = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    
    // Create user profile in Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email,
      displayName,
      photoURL: result.user.photoURL || '',
      emailLower: (email || '').toLowerCase(),
      displayNameLower: (displayName || '').toLowerCase(),
      bio: '',
      walletBalance: 0,
      totalDonated: 0,
      totalReceived: 0,
      createdAt: new Date().toISOString(),
    });
    
    return result;
  };

  // Login with email and password
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Login with Google
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // Check if user profile exists, if not create one
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL || '',
        emailLower: (result.user.email || '').toLowerCase(),
        displayNameLower: (result.user.displayName || '').toLowerCase(),
        bio: '',
        walletBalance: 0,
        totalDonated: 0,
        totalReceived: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      // Update photoURL if it exists in Google account but not in Firestore
      const userData = userDoc.data();
      if (result.user.photoURL && userData.photoURL !== result.user.photoURL) {
        await setDoc(doc(db, 'users', result.user.uid), {
          ...userData,
          photoURL: result.user.photoURL,
          displayName: result.user.displayName, // Also update display name
          displayNameLower: (result.user.displayName || '').toLowerCase(),
        }, { merge: true });
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
