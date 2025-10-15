import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your Firebase config
// Get this from Firebase Console > Project Settings > Your apps
const firebaseConfig = {
  apiKey: "AIzaSyCpiVx8ZHPuTwlj5E3Yy2TrVFtjxsp4L-E",
  authDomain: "gfundreach.firebaseapp.com",
  projectId: "gfundreach",
  storageBucket: "gfundreach.firebasestorage.app",
  messagingSenderId: "117924750009",
  appId: "1:117924750009:web:1b2b9d96b1eabea8d1f168",
  measurementId: "G-2NTNXDWEXH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
