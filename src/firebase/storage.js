import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

export const uploadFile = async (file, path, onProgress) => {
  const storageRef = ref(storage, path)
  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        if (onProgress) onProgress(progress)
      },
      reject,
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadURL)
      }
    )
  })
}

export const uploadPhoto = async (file, folder, id) => {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${id}_${Date.now()}.${ext}`
  return uploadFile(file, path)
}

export const deleteFile = async (url) => {
  try {
    const fileRef = ref(storage, url)
    await deleteObject(fileRef)
  } catch (err) {
    console.warn('Could not delete file:', err)
  }
}
