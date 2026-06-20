import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6lNTpjfPbvjrkQ-iiBX54rvTqS8kiWa8",
  authDomain: "proj-hootcamp-1.firebaseapp.com",
  projectId: "proj-hootcamp-1",
  storageBucket: "proj-hootcamp-1.firebasestorage.app",
  messagingSenderId: "509474371118",
  appId: "1:509474371118:web:b1d909535254c0fad051bf",
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