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

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Reuse secondary app if already initialised
const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ||
  initializeApp(firebaseConfig, 'secondary')

const secondaryAuth = getAuth(secondaryApp)

// ─── Create Student (Auth + Firestore) ────────────────────────────────────────
export const createStudentAccount = async (email, password, studentData) => {
  // 1. Create Firebase Auth user on secondary app (admin stays logged in)
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
  } catch (err) {
    // Rethrow with a clear message
    throw new Error(`Auth creation failed: ${err.message}`)
  } finally {
    // Always sign out of secondary to keep it clean
    try { await signOut(secondaryAuth) } catch (_) {}
  }

  // 2. Write Firestore document using the primary db (admin is authenticated)
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
  // 1. Create Firebase Auth user on secondary app
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    uid = cred.user.uid
  } catch (err) {
    throw new Error(`Auth creation failed: ${err.message}`)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }

  // 2. Write Firestore document
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

// ─── Admin set password (sign in secondary, update, sign out) ─────────────────
export const adminSetPassword = async (email, currentPassword, newPassword) => {
  const cred = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword)
  try {
    await updatePassword(cred.user, newPassword)
  } finally {
    try { await signOut(secondaryAuth) } catch (_) {}
  }
}

// ─── Update Student Firestore only ────────────────────────────────────────────
export const updateStudentRecord = async (uid, data) => {
  await updateDoc(doc(db, 'students', uid), { ...data, updatedAt: serverTimestamp() })
}

// ─── Update Employee Firestore only ───────────────────────────────────────────
export const updateEmployeeRecord = async (uid, data) => {
  await updateDoc(doc(db, 'employees', uid), { ...data, updatedAt: serverTimestamp() })
}

// ─── Activate / Deactivate ────────────────────────────────────────────────────
export const deactivateStudent = async (uid) =>
  updateDoc(doc(db, 'students', uid), { status: 'inactive', updatedAt: serverTimestamp() })

export const activateStudent = async (uid) =>
  updateDoc(doc(db, 'students', uid), { status: 'active', updatedAt: serverTimestamp() })

export const deactivateEmployee = async (uid) =>
  updateDoc(doc(db, 'employees', uid), { status: 'inactive', updatedAt: serverTimestamp() })

export const activateEmployee = async (uid) =>
  updateDoc(doc(db, 'employees', uid), { status: 'active', updatedAt: serverTimestamp() })

// ─── Delete Firestore record ───────────────────────────────────────────────────
export const deleteStudentRecord  = async (uid) => deleteDoc(doc(db, 'students',  uid))
export const deleteEmployeeRecord = async (uid) => deleteDoc(doc(db, 'employees', uid))
