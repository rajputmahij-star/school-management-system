import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { HiAcademicCap, HiEye, HiEyeOff, HiMoon, HiSun, HiArrowLeft } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { auth } from '../../firebase/config'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function LoginPage() {
  const [view, setView]               = useState('login') // 'login' | 'forgot'
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [resetEmail, setResetEmail]   = useState('')
  const [resetSent, setResetSent]     = useState(false)

  const { login, userData } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    if (userData) {
      const r = { admin: '/admin/dashboard', employee: '/employee/dashboard', student: '/student/dashboard' }
      navigate(r[userData.role] || '/login')
    }
  }, [userData, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please enter your email and password'); return }
    setLoading(true)
    try {
      const data = await login(email, password)
      const r = { admin: '/admin/dashboard', employee: '/employee/dashboard', student: '/student/dashboard' }
      toast.success('Welcome back!')
      navigate(r[data.role])
    } catch (err) {
      // Show friendly messages instead of raw Firebase errors
      const code = err.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        toast.error('This email is not registered. Please check and try again.')
      } else if (code === 'auth/wrong-password') {
        toast.error('Wrong password. Please try again.')
      } else if (code === 'auth/invalid-credential') {
        toast.error('Wrong email or password. Please check and try again.')
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please wait a few minutes and try again.')
      } else if (code === 'auth/user-disabled') {
        toast.error('This account has been disabled. Please contact admin.')
      } else if (code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection.')
      } else {
        toast.error(err.message?.replace('Firebase: ', '').replace(/\s*\(auth\/.*\)\.?/, '') || 'Login failed. Please try again.')
      }
    } finally { setLoading(false) }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!resetEmail.trim()) { toast.error('Enter your registered email address'); return }
    setLoading(true)
    try {
      // actionCodeSettings helps email clients recognise this as legitimate
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: false,
      }
      await sendPasswordResetEmail(auth, resetEmail.trim(), actionCodeSettings)
      setResetSent(true)
      toast.success('Password reset email sent!')
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        toast.error('No account found with this email address.')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Invalid email address. Please check and try again.')
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please wait a few minutes and try again.')
      } else {
        toast.error('Failed to send reset email. Please try again.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #16377A 0%, #095D30 80%, #0b1b40 100%)' }}>
      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-sm">
        {theme === 'dark' ? <HiSun className="w-5 h-5" /> : <HiMoon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="p-6 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #16377A 0%, #095D30 100%)' }}>
            {/* decorative blobs */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-500/20 rounded-full blur-xl" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-lime-500/20 rounded-full blur-xl" />
            {/* Both logos side by side */}
            <div className="flex items-center justify-center gap-3 mb-3 relative">
              <img src="/Trust Logo.avif" alt="Trust Logo"
                className="w-16 h-16 object-contain rounded-xl ring-2 ring-white/20" />
              <img src="/image.png" alt="School Logo"
                className="w-16 h-16 object-contain rounded-xl ring-2 ring-white/20" />
            </div>
            <h1 className="font-school text-2xl font-bold text-orange-400 tracking-wide uppercase">
              ANAND SPECIAL SCHOOL
            </h1>
            <p className="text-white/70 text-xs mt-0.5">Mngd. By Anand Rehabilitation Trust</p>
          </div>

          <div className="p-8 bg-white dark:bg-gray-900">
            {/* ── LOGIN VIEW ── */}
            {view === 'login' && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Sign In</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="label">Email Address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@school.com" className="input-field" autoComplete="email" required />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" className="input-field pr-10"
                        autoComplete="current-password" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        {showPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot password link */}
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setView('forgot'); setResetSent(false); setResetEmail('') }}
                      className="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 font-medium">
                      Forgot Password?
                    </button>
                  </div>

                  <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-2.5">
                    {loading ? <><LoadingSpinner size="sm" /> Signing in…</> : 'Sign In'}
                  </button>
                </form>
              </>
            )}

            {/* ── FORGOT PASSWORD VIEW ── */}
            {view === 'forgot' && (
              <>
                <button onClick={() => setView('login')}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5">
                  <HiArrowLeft className="w-4 h-4" /> Back to Login
                </button>

                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Reset Password</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Enter your registered email and we'll send you a secure reset link.
                </p>

                {resetSent ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-center space-y-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                      <span className="text-2xl">✉️</span>
                    </div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Reset email sent!</p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Check your inbox at <strong>{resetEmail}</strong> and click the reset link.
                      If you don't see it, check your <strong>Spam / Junk</strong> folder.
                    </p>
                    <button onClick={() => { setView('login'); setResetSent(false) }}
                      className="text-xs text-primary-600 hover:underline font-medium">
                      Return to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="label">Registered Email Address</label>
                      <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@school.com" className="input-field" required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-2.5">
                      {loading ? <><LoadingSpinner size="sm" /> Sending…</> : 'Send Reset Link'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © {new Date().getFullYear()} Anand Special School Management System
        </p>
      </div>
    </div>
  )
}
