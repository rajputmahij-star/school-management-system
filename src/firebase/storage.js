import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

export const uploadFile = async (file, path, onProgress) => {
  const storageRef = ref(storage, path)

  // If no progress callback needed, use simpler uploadBytes (no hanging promise)
  if (!onProgress) {
    const snapshot = await uploadBytes(storageRef, file)
    return getDownloadURL(snapshot.ref)
  }

  // With progress tracking use resumable upload
  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    // 30 second timeout guard — prevents infinite "Updating..." spinner
    const timeout = setTimeout(() => {
      uploadTask.cancel()
      reject(new Error('Upload timed out. Check your internet connection and try again.'))
    }, 30000)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        if (onProgress) onProgress(progress)
      },
      (err) => {
        clearTimeout(timeout)
        reject(err)
      },
      async () => {
        clearTimeout(timeout)
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadURL)
      }
    )
  })
}

export const uploadPhoto = async (file, folder, id) => {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${id}_${Date.now()}.${ext}`
  return uploadFile(file, path) // uses simple uploadBytes internally
}

export const deleteFile = async (url) => {
  try {
    const fileRef = ref(storage, url)
    await deleteObject(fileRef)
  } catch (err) {
    console.warn('Could not delete file:', err)
  }
}
