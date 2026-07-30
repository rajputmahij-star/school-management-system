import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

/**
 * Try to find the current Auth email for a user who entered their pendingEmail.
 * Reads from pending_email_changes collection — publicly readable, no auth needed.
 */
const findAuthEmailByPendingEmail = async (pendingEmail) => {
  try {
    const q = query(
      collection(db, 'pending_email_changes'),
      where('newEmail', '==', pendingEmail.trim().toLowerCase())
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      return snap.docs[0].data().oldEmail || null
    }
  } catch (err) {
    console.warn('pendingEmail lookup failed:', err.message)
  }
  return null
}

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  } catch (err) {
    // If login fails, check if user entered their new (pending) email
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
      const oldEmail = await findAuthEmailByPendingEmail(email.trim())
      if (oldEmail) {
        // Log in with the old Firebase Auth email
        const userCredential = await signInWithEmailAndPassword(auth, oldEmail, password)
        return userCredential.user
      }
    }
    throw err
  }
}

export const logoutUser = async () => {
  await signOut(auth)
}

export const getCurrentUserData = async (uid) => {
  // Check admins collection
  const adminDoc = await getDoc(doc(db, 'admins', uid))
  if (adminDoc.exists()) {
    return { ...adminDoc.data(), role: 'admin', uid }
  }

  // Check employees collection
  const empDoc = await getDoc(doc(db, 'employees', uid))
  if (empDoc.exists()) {
    const empData = { ...empDoc.data(), role: 'employee', uid }
    // Apply pending email change if set by admin
    await applyPendingEmailChange(uid, empDoc.ref, empData)
    return empData
  }

  // Check students collection by uid field
  const studentsRef = collection(db, 'students')
  const q = query(studentsRef, where('uid', '==', uid))
  const snapshot = await getDocs(q)
  if (!snapshot.empty) {
    const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), role: 'student', uid }
    if (studentData.leaveDate) {
      const leaveDate = studentData.leaveDate?.toDate
        ? studentData.leaveDate.toDate()
        : new Date(studentData.leaveDate)
      if (new Date() > leaveDate) {
        throw new Error('Student is no longer active in the school.')
      }
    }
    // Apply pending email change if set by admin
    await applyPendingEmailChange(uid, snapshot.docs[0].ref, studentData)
    return studentData
  }

  throw new Error('User not found in system.')
}

/**
 * If admin set a pendingEmail on the Firestore doc,
 * update Firebase Auth email using the user's own active session (free, no Cloud Functions).
 * Then clear pendingEmail from Firestore.
 */
const applyPendingEmailChange = async (uid, docRef, userData) => {
  if (!userData.pendingEmail) return
  const user = auth.currentUser
  if (!user || user.uid !== uid) return
  try {
    await updateEmail(user, userData.pendingEmail)
    await updateDoc(docRef, {
      email: userData.pendingEmail,
      pendingEmail: null,
      oldEmail: null,
      updatedAt: serverTimestamp(),
    })
    // Clean up the pending_email_changes record
    const q = query(
      collection(db, 'pending_email_changes'),
      where('uid', '==', uid)
    )
    const snap = await getDocs(q)
    snap.forEach(async (d) => {
      try { await updateDoc(d.ref, { completed: true }) } catch {}
    })
  } catch (err) {
    console.warn('Pending email change failed:', err.message)
  }
}

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

export { onAuthStateChanged, auth }
