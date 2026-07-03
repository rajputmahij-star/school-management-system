import React from 'react'
import { useNavigate } from 'react-router-dom'
import { HiHome, HiExclamationCircle } from 'react-icons/hi'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { userData } = useAuth()

  const goHome = () => {
    if (!userData) return navigate('/login')
    const redirects = {
      admin: '/admin/dashboard',
      employee: '/employee/dashboard',
      student: '/student/dashboard',
    }
    navigate(redirects[userData.role] || '/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <HiExclamationCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
        <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Page Not Found</p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button onClick={goHome} className="btn-primary mx-auto">
          <HiHome className="w-4 h-4" /> Go to Dashboard
        </button>
      </div>
    </div>
  )
}
