import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, userData, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user || !userData) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    // Redirect to appropriate dashboard
    const roleRedirects = {
      admin: '/admin/dashboard',
      employee: '/employee/dashboard',
      student: '/student/dashboard',
    }
    return <Navigate to={roleRedirects[userData.role] || '/login'} replace />
  }

  return children
}
