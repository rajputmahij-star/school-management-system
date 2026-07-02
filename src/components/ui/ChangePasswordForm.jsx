/**
 * ChangePasswordForm — focus-safe, memoised
 *
 * ROOT CAUSE of focus loss (fixed here):
 *  1. PwField defined inside component → new reference each render → remount → focus lost.
 *     Fix: PwField at MODULE SCOPE.
 *  2. Parent pages re-render when loading state changes → ChangePasswordForm re-renders.
 *     Fix: wrap in React.memo so it only re-renders when its own state changes.
 *  3. onChange handlers were inline arrow functions → new reference each render.
 *     Fix: useCallback with [] deps.
 */
import React, { useState, useCallback, memo } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { auth } from '../../firebase/config'
import { HiKey, HiEye, HiEyeOff } from 'react-icons/hi'
import LoadingSpinner from './LoadingSpinner'
import toast from 'react-hot-toast'

// ── MODULE SCOPE — same reference every render, never causes remount ──────────
const PwField = ({ label, value, onChange, show, onToggle, placeholder }) => (
  <div>
    <label className="label">{label}</label>
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field pr-10"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {show ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
      </button>
    </div>
  </div>
)

// ── memo() → parent re-renders don't affect this component ───────────────────
const ChangePasswordForm = memo(function ChangePasswordForm() {
  const [current,     setCurrent]     = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)

  // Stable handlers — [] dep means same function reference forever
  const onCurrent      = useCallback((e) => setCurrent(e.target.value),     [])
  const onNewPw        = useCallback((e) => setNewPw(e.target.value),       [])
  const onConfirm      = useCallback((e) => setConfirm(e.target.value),     [])
  const toggleCurrent  = useCallback(() => setShowCurrent((p) => !p),       [])
  const toggleNew      = useCallback(() => setShowNew((p) => !p),           [])
  const toggleConfirm  = useCallback(() => setShowConfirm((p) => !p),       [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!current)          { toast.error('Enter your current password');           return }
    if (newPw.length < 6)  { toast.error('New password must be at least 6 chars'); return }
    if (newPw !== confirm)  { toast.error('New passwords do not match');            return }

    setLoading(true)
    try {
      const user       = auth.currentUser
      const credential = EmailAuthProvider.credential(user.email, current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPw)
      toast.success('Password changed successfully')
      setCurrent(''); setNewPw(''); setConfirm('')
    } catch (err) {
      const msg =
        err.code === 'auth/wrong-password'        ? 'Current password is incorrect.'       :
        err.code === 'auth/invalid-credential'    ? 'Current password is incorrect.'       :
        err.code === 'auth/too-many-requests'     ? 'Too many attempts. Try again later.'  :
        err.code === 'auth/requires-recent-login' ? 'Session expired. Please log in again.':
        err.message || 'Password change failed'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="card p-4 sm:p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
        <HiKey className="w-5 h-5 text-primary-600" /> Change Password
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <PwField label="Current Password" value={current} onChange={onCurrent}
          show={showCurrent} onToggle={toggleCurrent} placeholder="Your current password" />
        <PwField label="New Password" value={newPw} onChange={onNewPw}
          show={showNew} onToggle={toggleNew} placeholder="Min 6 characters" />
        <PwField label="Confirm New Password" value={confirm} onChange={onConfirm}
          show={showConfirm} onToggle={toggleConfirm} placeholder="Repeat new password" />
        <button type="submit" disabled={loading} className="w-full sm:w-auto btn-primary">
          {loading
            ? <><LoadingSpinner size="sm" /> Changing…</>
            : <><HiKey className="w-4 h-4" /> Change Password</>}
        </button>
      </form>
    </div>
  )
})

export default ChangePasswordForm
