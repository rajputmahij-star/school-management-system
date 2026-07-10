import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getStudentAttendance, getFees, getPayments } from '../../firebase/firestore'
import { formatCurrency, calculateAge, formatDate, calculateAttendancePercent } from '../../utils/helpers'
import StatCard from '../../components/ui/StatCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { HiAcademicCap, HiCalendar, HiCurrencyRupee, HiCheck } from 'react-icons/hi'
import { format } from 'date-fns'

export default function StudentDashboard() {
  const { userData, refreshUserData } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const now = new Date()

  // Refresh on mount to pick up latest photo set by admin
  useEffect(() => {
    refreshUserData().catch(() => {})
  }, [])

  useEffect(() => {
    if (userData?.id) loadStats()
  }, [userData])

  const loadStats = async () => {
    try {
      const [attendance, fees, payments] = await Promise.all([
        getStudentAttendance(userData.id, now.getMonth() + 1, now.getFullYear()),
        getFees(userData.id),
        getPayments(userData.id),
      ])

      const presentDays = attendance.filter((a) => a.attendanceType === 'Present').length
      const totalDays = attendance.length
      const pendingFees = fees.filter((f) => !payments.some((p) => p.feeId === f.id && p.paymentStatus === 'Paid'))
      const totalPending = pendingFees.reduce((s, f) => s + (f.amount || 0), 0)

      setStats({
        presentDays,
        totalDays,
        attendancePercent: calculateAttendancePercent(presentDays, totalDays),
        pendingFees: pendingFees.length,
        totalPending,
        totalPaid: payments.filter((p) => p.paymentStatus === 'Paid').reduce((s, p) => s + (p.totalAmount || 0), 0),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Welcome, {userData?.studentName}
        </h1>
        <p className="text-sm text-gray-500">{format(now, 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Profile Summary */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            {userData?.photo ? (
              <img src={userData.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                {userData?.studentName?.[0]}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">{userData?.studentName}</h2>
            <p className="text-sm text-gray-500">Class {userData?.className}</p>
            <p className="text-xs text-gray-400 mt-1">GR: {userData?.grNumber} • ID: {userData?.studentId}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="This Month Present" value={stats?.presentDays} icon={HiCheck} color="green" />
        <StatCard title="Attendance %" value={`${stats?.attendancePercent}%`} icon={HiCalendar} color="blue" />
        <StatCard title="Pending Fees" value={stats?.pendingFees} icon={HiCurrencyRupee} color="yellow" />
        <StatCard title="Total Paid" value={formatCurrency(stats?.totalPaid)} icon={HiAcademicCap} color="purple" />
      </div>
    </div>
  )
}
