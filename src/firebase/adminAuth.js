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
  updateEmail,
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

// ─── Admin set password (requires current password) ───────────────────────────
export const adminSetPassword = async (email, currentPassword, newPassword) => {
  const cred = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword)
  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Admin force-reset password ───────────────────────────────────────────────
// Tries to sign in with the known default password (padded GR/Employee ID),
// then updates password. If user already changed it, sends a reset email.
export const adminForceResetPassword = async (email, knownCurrentPw, newPassword) => {
  let cred
  try {
    cred = await signInWithEmailAndPassword(secondaryAuth, email, knownCurrentPw)
  } catch (_) {
    // Password was changed — send reset email
    try { await sendPasswordResetEmail(primaryAuth, email) } catch (e) {
      throw new Error(`User changed their password. Reset email failed: ${e.message}`)
    }
    throw new Error(
      `User has changed their password. A reset email has been sent to ${email}. Ask them to check their inbox.`
    )
  }
  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Admin update Auth email ───────────────────────────────────────────────────
// Signs into secondary app with known password, updates Auth email.
// Returns { success, method } where method is 'auth' or 'pending'.
export const adminUpdateAuthEmail = async (oldEmail, newEmail, knownPassword) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error('Invalid email format')
  }
  if (oldEmail.trim().toLowerCase() === newEmail.trim().toLowerCase()) {
    return { success: true, method: 'noop' }
  }

  // Try to sign in with known password to update Auth email directly
  let cred
  try {
    cred = await signInWithEmailAndPassword(secondaryAuth, oldEmail, knownPassword)
  } catch (_) {
    // Can't sign in — return special code so caller saves as pending
    return { success: false, method: 'pending' }
  }

  try {
    await updateEmail(cred.user, newEmail)
    return { success: true, method: 'auth' }
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered to another account')
    }
    return { success: false, method: 'pending' }
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
