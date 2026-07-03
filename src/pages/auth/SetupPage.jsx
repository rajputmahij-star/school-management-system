/**
 * One-time setup page — accessible at /setup
 * Creates the first admin account when no admins exist yet.
 * Remove this route from App.jsx after initial setup for security.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { HiAcademicCap, HiShieldCheck } from 'react-icons/hi'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function SetupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [alreadySetup, setAlreadySetup] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if any admin already exists
    getDocs(collection(db, 'admins')).then((snap) => {
      if (!snap.empty) setAlreadySetup(true)
      setChecking(false)
    }).catch(() => setChecking(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password)
      const uid = userCredential.user.uid

      // Create admin document in Firestore
      await setDoc(doc(db, 'admins', uid), {
        adminName: form.name,
        email: form.email,
        role: 'admin',
        createdAt: serverTimestamp(),
      })

      toast.success('Admin account created! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      toast.error(err.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (alreadySetup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md w-full">
          <HiShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Already Configured</h2>
          <p className="text-gray-500 mb-6">An admin account already exists. Please login normally.</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-8 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <HiAcademicCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Initial Setup</h1>
          <p className="text-primary-200 text-sm mt-1">Create the first admin account</p>
        </div>

        <div className="p-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              ⚠️ This page should be removed from App.jsx after initial setup for security.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Admin Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full Name"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@school.com"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 characters"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="Repeat password"
                className="input-field"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-2.5 mt-2">
              {loading ? <><LoadingSpinner size="sm" /> Creating Admin...</> : 'Create Admin Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
