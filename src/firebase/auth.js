import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from './config'

export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  return userCredential.user
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
    return { ...empDoc.data(), role: 'employee', uid }
  }

  // Check students collection by uid field
  const studentsRef = collection(db, 'students')
  const q = query(studentsRef, where('uid', '==', uid))
  const snapshot = await getDocs(q)
  if (!snapshot.empty) {
    const studentData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), role: 'student', uid }
    // Check if student is still active
    if (studentData.leaveDate) {
      const leaveDate = studentData.leaveDate?.toDate
        ? studentData.leaveDate.toDate()
        : new Date(studentData.leaveDate)
      if (new Date() > leaveDate) {
        throw new Error('Student is no longer active in the school.')
      }
    }
    return studentData
  }

  throw new Error('User not found in system.')
}

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

export { onAuthStateChanged, auth }
