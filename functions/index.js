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
  // Try students first, then employees
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
