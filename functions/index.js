const functions = require('firebase-functions')
const admin     = require('firebase-admin')

admin.initializeApp()

/**
 * updateUserEmail
 * Called by admin to change a user's Firebase Auth email.
 * Only callable by authenticated users who exist in the /admins collection.
 *
 * Request data: { uid: string, newEmail: string }
 */
exports.updateUserEmail = functions.https.onCall(async (data, context) => {
  // 1. Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.')
  }

  // 2. Must be an admin (check /admins/{uid} doc)
  const adminDoc = await admin.firestore()
    .collection('admins')
    .doc(context.auth.uid)
    .get()

  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can update emails.')
  }

  const { uid, newEmail } = data

  if (!uid || !newEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'uid and newEmail are required.')
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format.')
  }

  // 3. Update Firebase Auth email
  await admin.auth().updateUser(uid, { email: newEmail })

  // 4. Update Firestore record (students or employees collection)
  const studentRef  = admin.firestore().collection('students').doc(uid)
  const employeeRef = admin.firestore().collection('employees').doc(uid)

  const [studentSnap, employeeSnap] = await Promise.all([
    studentRef.get(),
    employeeRef.get(),
  ])

  if (studentSnap.exists) {
    await studentRef.update({ email: newEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  } else if (employeeSnap.exists) {
    await employeeRef.update({ email: newEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
  }

  return { success: true, message: `Email updated to ${newEmail}` }
})

/**
 * resetUserPassword
 * Called by admin to force-reset any user's password WITHOUT knowing current password.
 * Uses Firebase Admin SDK — only admins can call this.
 *
 * Request data: { email: string, newPassword: string }
 */
exports.resetUserPassword = functions.https.onCall(async (data, context) => {
  // 1. Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.')
  }

  // 2. Must be an admin
  const adminDoc = await admin.firestore()
    .collection('admins')
    .doc(context.auth.uid)
    .get()

  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can reset passwords.')
  }

  const { email, newPassword } = data

  if (!email || !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'email and newPassword are required.')
  }

  if (newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.')
  }

  // 3. Look up user by email
  let userRecord
  try {
    userRecord = await admin.auth().getUserByEmail(email)
  } catch (err) {
    throw new functions.https.HttpsError('not-found', `No user found with email: ${email}`)
  }

  // 4. Force update password — no current password needed with Admin SDK
  await admin.auth().updateUser(userRecord.uid, { password: newPassword })

  return { success: true, message: `Password reset successfully for ${email}` }
})
