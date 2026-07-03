import React from 'react'
import { HiExclamation } from 'react-icons/hi'
import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <HiExclamation className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary text-sm w-full sm:w-auto justify-center">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading} className="btn-danger text-sm w-full sm:w-auto justify-center">
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}
