import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD6lNTpjfPbvjrkQ-iiBX54rvTqS8kiWa8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "proj-hootcamp-1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "proj-hootcamp-1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "proj-hootcamp-1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "509474371118",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:509474371118:web:b1d909535254c0fad051bf",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export function requireFirebase() {
  if (!firebaseConfigured || !auth || !db) {
    throw new Error("Configure Firebase environment variables before using the app.");
  }

  return { auth, db };
}