import { getFunctions, httpsCallable } from 'firebase/functions'
import app from './config'

const functions = getFunctions(app)

/**
 * Update a user's Firebase Auth login email.
 * Can only be called by an admin.
 * @param {string} uid - Firebase Auth UID of the user
 * @param {string} newEmail - New email address
 */
export const updateUserEmail = async (uid, newEmail) => {
  const fn = httpsCallable(functions, 'updateUserEmail')
  const result = await fn({ uid, newEmail })
  return result.data
}
