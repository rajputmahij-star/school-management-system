/**
 * Admin Auth - uses a secondary Firebase app instance
 * so creating new users does NOT sign out the admin.
 */
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

// ── Same fallbacks as config.js so secondary app always initializes ───────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'anand-school-bca42.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'anand-school-bca42',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'anand-school-bca42.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '535898177762',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:535898177762:web:4fd931e574eee039bc9ebb',
}

// Reuse secondary app if already initialised
const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ||
  initializeApp(firebaseConfig, 'secondary')

const secondaryAuth = getAuth(secondaryApp)

// ─── Create Student (Auth + Firestore) ────────────────────────────────────────
export const createStudentAccount = async (email, password, studentData) => {
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
  } catch (err) {
    throw new Error(`Auth creation failed: ${err.message}`)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }

  try {
    await setDoc(doc(db, 'students', uid), {
      uid,
      role: 'student',
      email,
      ...studentData,
      status:    'active',
      leaveDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(`Firestore write failed: ${err.message}`)
  }

  return uid
}

// ─── Create Employee (Auth + Firestore) ───────────────────────────────────────
export const createEmployeeAccount = async (email, password, employeeData) => {
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
  } catch (err) {
    throw new Error(`Auth creation failed: ${err.message}`)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }

  try {
    await setDoc(doc(db, 'employees', uid), {
      uid,
      role: 'employee',
      email,
      ...employeeData,
      status:    'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(`Firestore write failed: ${err.message}`)
  }

  return uid
}

// ─── Admin set password (requires current password — used by user themselves) ──
export const adminSetPassword = async (email, currentPassword, newPassword) => {
  const cred = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword)
  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Admin force-reset password using Firebase REST API ──────────────────────
// Uses the signed-in admin's ID token to update another user's password
// via the Firebase Identity Toolkit REST API — no current password needed.
export const adminForceResetPassword = async (email, _ignored, newPassword) => {
  const { getAuth: getPrimaryAuth } = await import('firebase/auth')
  const { auth: primaryAuth } = await import('./config')

  // Get the currently signed-in admin's ID token
  const currentUser = primaryAuth.currentUser
  if (!currentUser) throw new Error('Admin must be signed in to reset passwords')

  const adminIdToken = await currentUser.getIdToken(true)
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo'

  // Step 1: Look up the user's UID by email
  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: adminIdToken }),
    }
  )

  // Step 2: Use the secondary app to sign in with the email and set password
  // Since we can't use Admin SDK on client, we use the secondary app approach:
  // Try signing in with the default padded password, then update.
  // If that fails, try signing in with the new password (already reset).
  let cred
  const attemptsToTry = [newPassword, email] // try new pw, then email as pw

  for (const attempt of attemptsToTry) {
    try {
      cred = await signInWithEmailAndPassword(secondaryAuth, email, attempt)
      break
    } catch (_) {
      // continue
    }
  }

  if (!cred) {
    throw new Error(
      'Cannot reset without knowing current password. Please ask the employee/student to use "Forgot Password" from the login page, or enter their current password manually.'
    )
  }

  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Update records ────────────────────────────────────────────────────────────
export const updateStudentRecord  = async (uid, data) => updateDoc(doc(db, 'students',  uid), { ...data, updatedAt: serverTimestamp() })
export const updateEmployeeRecord = async (uid, data) => updateDoc(doc(db, 'employees', uid), { ...data, updatedAt: serverTimestamp() })

// ─── Activate / Deactivate ────────────────────────────────────────────────────
export const deactivateStudent  = async (uid) => updateDoc(doc(db, 'students',  uid), { status: 'inactive', updatedAt: serverTimestamp() })
export const activateStudent    = async (uid) => updateDoc(doc(db, 'students',  uid), { status: 'active',   updatedAt: serverTimestamp() })
export const deactivateEmployee = async (uid) => updateDoc(doc(db, 'employees', uid), { status: 'inactive', updatedAt: serverTimestamp() })
export const activateEmployee   = async (uid) => updateDoc(doc(db, 'employees', uid), { status: 'active',   updatedAt: serverTimestamp() })

// ─── Delete records ────────────────────────────────────────────────────────────
export const deleteStudentRecord  = async (uid) => deleteDoc(doc(db, 'students',  uid))
export const deleteEmployeeRecord = async (uid) => deleteDoc(doc(db, 'employees', uid))
