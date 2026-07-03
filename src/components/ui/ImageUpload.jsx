import React, { useState, useRef } from 'react'
import { HiCamera, HiUser } from 'react-icons/hi'
import LoadingSpinner from './LoadingSpinner'

export default function ImageUpload({ currentUrl, onUpload, folder = 'photos', disabled }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl)
  const fileRef = useRef()

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      await onUpload(file)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <HiUser className="w-10 h-10 text-gray-400" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <LoadingSpinner size="sm" className="border-white border-t-transparent" />
            </div>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors shadow-md"
          >
            <HiCamera className="w-4 h-4" />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
      {uploading && <p className="text-xs text-gray-500">Uploading...</p>}
    </div>
  )
}
