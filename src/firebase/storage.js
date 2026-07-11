/**
 * Photo upload via Cloudinary (unsigned preset)
 * No Firebase Storage needed — works on free Spark plan
 */

const CLOUD_NAME  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME  || 'jpt3owqf'
const UPLOAD_PRESET = 'school_photos'   // unsigned preset created on Cloudinary

/**
 * Upload a file to Cloudinary and return the secure URL.
 * @param {File}   file    - The image file to upload
 * @param {string} folder  - Cloudinary folder (e.g. 'students', 'employees')
 * @param {string} id      - Unique ID used as the public_id
 * @returns {Promise<string>} - Secure HTTPS URL of the uploaded image
 */
export const uploadPhoto = async (file, folder, id) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', `school/${folder}`)
  formData.append('public_id', `${id}_${Date.now()}`)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Cloudinary upload failed')
  }

  const data = await response.json()
  return data.secure_url  // e.g. https://res.cloudinary.com/jpt3owqf/image/upload/...
}

/**
 * uploadFile kept for backward compatibility (same as uploadPhoto)
 */
export const uploadFile = async (file, path) => {
  // Extract folder and id from path (e.g. "students/uid_123.jpg")
  const parts = path.split('/')
  const folder = parts[0] || 'uploads'
  const id     = parts[parts.length - 1].replace(/\.[^.]+$/, '')
  return uploadPhoto(file, folder, id)
}

/**
 * deleteFile — Cloudinary deletion requires server-side signed request.
 * For now, we just log and skip (old photos stay in Cloudinary but don't affect the app).
 */
export const deleteFile = async (url) => {
  console.log('deleteFile: skipped (Cloudinary deletion requires server-side auth)', url)
}
