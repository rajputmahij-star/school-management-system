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
import { db, auth as primaryAuth } from './config'

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAAUFv1VjQglrKtNIErIEo6udoJ9TYWzbo'

// ── Same fallbacks as config.js so secondary app always initializes ───────────
const firebaseConfig = {
  apiKey:            API_KEY,
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
      uid, role: 'student', email, ...studentData,
      status: 'active', leaveDate: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
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

// ─── Admin force-reset password via Firebase Identity Toolkit REST API ────────
// Uses the admin's own ID token to update another user's password.
// Works without Cloud Functions — uses Google's Identity Toolkit API.
export const adminForceResetPassword = async (email, _ignored, newPassword) => {
  // Step 1: Get admin's current ID token
  const adminUser = primaryAuth.currentUser
  if (!adminUser) throw new Error('Not signed in as admin')
  const idToken = await adminUser.getIdToken(true)

  // Step 2: Get the target user's UID by looking them up
  // We use the signInWithPassword endpoint to get UID from email
  // Since we don't know their password, we use the admin's token to call
  // the accounts:update endpoint directly with localId

  // First get target user UID via lookup with admin token
  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  )
  const lookupData = await lookupRes.json()
  if (!lookupRes.ok) throw new Error(lookupData.error?.message || 'Lookup failed')

  // Find target user by email using admin REST API
  // We need to search for the user — use the admin's token with users list
  const searchRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'anand-school-bca42'}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email: [email] }),
    }
  )

  if (!searchRes.ok) {
    // Fallback: sign in with secondary app using a temp approach
    throw new Error('Admin API not available. Please use "Set Custom Password" below and enter the current password.')
  }

  const searchData = await searchRes.json()
  const targetUid = searchData.users?.[0]?.localId
  if (!targetUid) throw new Error(`No user found with email: ${email}`)

  // Step 3: Update password using admin REST API
  const updateRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,           // admin's token — can update any user IF admin has permission
        localId: targetUid,
        password: newPassword,
        returnSecureToken: false,
      }),
    }
  )
  const updateData = await updateRes.json()
  if (!updateRes.ok) throw new Error(updateData.error?.message || 'Password update failed')

  return { success: true }
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
