import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyABv1MMNFZfZA96Um_d3pAvxPRKHt1Gt5w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mysyntromed-81242.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mysyntromed-81242",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mysyntromed-81242.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1074510275502",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1074510275502:web:19af06d958694d5d221e3f",
};

const requiredKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (requiredKeys.length > 0) {
  console.warn(`Missing Firebase env vars: ${requiredKeys.join(', ')}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

if (import.meta.env.VITE_RECAPTCHA_SITE_KEY && typeof window !== 'undefined') {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    console.log('[App Check] Initialized with reCAPTCHA Enterprise');
  } catch (error) {
    console.warn('[App Check] Failed to initialize:', error);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
