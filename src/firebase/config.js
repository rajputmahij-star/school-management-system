import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics, isSupported } from 'firebase/analytics'

// ── Firebase config — env vars first, hardcoded fallbacks for Vercel ──────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'anand-school-bca42.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'anand-school-bca42',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'anand-school-bca42.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '535898177762',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:535898177762:web:4fd931e574eee039bc9ebb',
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || 'G-5RBBC59DG4',
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)

// Analytics optional — won't crash if unsupported
export const analytics = isSupported().then((yes) => yes ? getAnalytics(app) : null).catch(() => null)

export default app
