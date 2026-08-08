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
  const trimmedEmail = email.trim().toLowerCase()

  try {
    // Step 1: Try direct login with whatever email the user typed
    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password)
    return userCredential.user
  } catch (err) {
    // Step 2: If login fails, check if the user typed their NEW (pending) email
    // but Firebase Auth still has their OLD email
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
      const oldEmail = await findAuthEmailByPendingEmail(trimmedEmail)
      if (oldEmail) {
        // Log in with the old Firebase Auth email + same password
        let userCredential
        try {
          userCredential = await signInWithEmailAndPassword(auth, oldEmail, password)
        } catch (innerErr) {
          // Old email login also failed — wrong password or account issue
          // Re-throw the original error so the UI shows the right message
          throw err
        }

        const user = userCredential.user

        // Session is fresh (just logged in) — now safely update Auth email to the new one
        try {
          await updateEmail(user, trimmedEmail)
          // Mark the pending change as completed in Firestore
          const q2 = query(
            collection(db, 'pending_email_changes'),
            where('newEmail', '==', trimmedEmail)
          )
          const snap2 = await getDocs(q2)
          snap2.forEach(async (d) => {
            try { await updateDoc(d.ref, { completed: true }) } catch {}
          })
        } catch (updateErr) {
          // updateEmail failed — non-fatal, user can still proceed
          console.warn('Auth email migration failed:', updateErr.code, updateErr.message)
        }

        return user
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
    await applyPendingEmailChange(uid, empDoc.ref, empData)
    await applyPendingPasswordChange(uid, empDoc.ref, empData)
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
    // Apply pending email/password changes if set by admin
    await applyPendingEmailChange(uid, snapshot.docs[0].ref, studentData)
    await applyPendingPasswordChange(uid, snapshot.docs[0].ref, studentData)
    return studentData
  }

  throw new Error('User not found in system.')
}

/**
 * If admin set a pendingEmail on the Firestore doc,
 * update Firebase Auth email using the user's own active session (free, no Cloud Functions).
 * Then clear pendingEmail from Firestore.
 *
 * Note: updateEmail() requires a recent session. If it fails, we leave the
 * pendingEmail so the login flow can retry via pending_email_changes lookup.
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
    console.log('Pending email change applied for', uid)
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      // Session too old — the login flow already handles this via pending_email_changes
      // so the user can still log in with the new email next time
      console.warn('Pending email change deferred (requires recent login):', uid)
    } else {
      console.warn('Pending email change failed:', err.code, err.message)
    }
  }
}

/**
 * If admin set a pendingPassword on the Firestore doc,
 * update Firebase Auth password using the user's own active session.
 * Then clear pendingPassword from Firestore.
 *
 * Note: updatePassword() requires the session to be recent. If it fails with
 * auth/requires-recent-login, we skip silently — the admin should use the
 * "Send Reset Email" button instead for locked-out users.
 */
const applyPendingPasswordChange = async (uid, docRef, userData) => {
  if (!userData.pendingPassword) return
  const user = auth.currentUser
  if (!user || user.uid !== uid) return
  try {
    await updatePassword(user, userData.pendingPassword)
    await updateDoc(docRef, {
      pendingPassword: null,
      updatedAt: serverTimestamp(),
    })
    console.log('Pending password change applied for', uid)
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      console.warn('Pending password deferred (requires recent login):', uid)
    } else {
      console.warn('Pending password change failed:', err.code, err.message)
    }
  }
}

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

export { onAuthStateChanged, auth }
