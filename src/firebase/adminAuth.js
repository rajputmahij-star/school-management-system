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
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth as primaryAuth } from './config'

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo'

const firebaseConfig = {
  apiKey:            API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'anand-school-bca42.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'anand-school-bca42',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'anand-school-bca42.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '535898177762',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:535898177762:web:4fd931e574eee039bc9ebb',
}

const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ||
  initializeApp(firebaseConfig, 'secondary')

const secondaryAuth = getAuth(secondaryApp)

// ─── Create Student ───────────────────────────────────────────────────────────
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
      uid, role: 'student', email, ...studentData,
      status: 'active', leaveDate: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(`Firestore write failed: ${err.message}`)
  }
  return uid
}

// ─── Create Employee ──────────────────────────────────────────────────────────
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
      uid, role: 'employee', email, ...employeeData,
      status: 'active',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(`Firestore write failed: ${err.message}`)
  }
  return uid
}

// ─── Admin set password (requires current password — user-initiated) ───────────
export const adminSetPassword = async (email, currentPassword, newPassword) => {
  const cred = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword)
  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Admin force-reset: sign in with known password and update ────────────────
// Works when the current password is the default (GR no. / Employee ID).
// If the user changed their password, it falls back to sending a reset email.
export const adminForceResetPassword = async (email, knownCurrentPw, newPassword) => {
  // Try signing in with the known current password (default padded ID/GR)
  let cred
  try {
    cred = await signInWithEmailAndPassword(secondaryAuth, email, knownCurrentPw)
  } catch (_) {
    // Password was already changed by user — send reset email as fallback
    try {
      await sendPasswordResetEmail(primaryAuth, email)
    } catch (e) {
      throw new Error(`Password changed by user. Reset email could not be sent: ${e.message}`)
    }
    throw new Error(
      `This user has already changed their password. A password reset email has been sent to ${email}. Ask them to check their inbox and reset using the link.`
    )
  }

  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Update records ───────────────────────────────────────────────────────────
export const updateStudentRecord  = async (uid, data) => updateDoc(doc(db, 'students',  uid), { ...data, updatedAt: serverTimestamp() })
export const updateEmployeeRecord = async (uid, data) => updateDoc(doc(db, 'employees', uid), { ...data, updatedAt: serverTimestamp() })

// ─── Activate / Deactivate ────────────────────────────────────────────────────
export const deactivateStudent  = async (uid) => updateDoc(doc(db, 'students',  uid), { status: 'inactive', updatedAt: serverTimestamp() })
export const activateStudent    = async (uid) => updateDoc(doc(db, 'students',  uid), { status: 'active',   updatedAt: serverTimestamp() })
export const deactivateEmployee = async (uid) => updateDoc(doc(db, 'employees', uid), { status: 'inactive', updatedAt: serverTimestamp() })
export const activateEmployee   = async (uid) => updateDoc(doc(db, 'employees', uid), { status: 'active',   updatedAt: serverTimestamp() })

// ─── Delete records ───────────────────────────────────────────────────────────
export const deleteStudentRecord  = async (uid) => deleteDoc(doc(db, 'students',  uid))
export const deleteEmployeeRecord = async (uid) => deleteDoc(doc(db, 'employees', uid))
