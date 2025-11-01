import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCpiVx8ZHPuTwlj5E3Yy2TrVFtjxsp4L-E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gfundreach.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gfundreach",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gfundreach.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "117924750009",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:117924750009:web:1b2b9d96b1eabea8d1f168",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-2NTNXDWEXH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Feature flag: enable/disable Firebase Storage uploads.
// Set VITE_STORAGE_ENABLED=true in your .env to use Firebase Storage.
// Defaults to false to support deployments without Storage; image uploads will use base64 in Firestore.
export const STORAGE_ENABLED = import.meta.env.VITE_STORAGE_ENABLED === 'true';

export default app;
