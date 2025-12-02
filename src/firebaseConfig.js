// src/firebaseConfig.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// DEBUG: Verifica que las variables se carguen
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Cargada' : '❌ Faltante',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Cargada' : '❌ Faltante',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Cargada' : '❌ Faltante'
});

// ✅ Evita reinicializar en Next (hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore / Storage
export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Auth + Google Provider
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export default app;