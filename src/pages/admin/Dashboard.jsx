import React, { useEffect, useState, useMemo } from 'react'
import {
  HiAcademicCap, HiUsers, HiCurrencyRupee, HiCalendar,
} from 'react-icons/hi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { getStudents, getEmployees, getPayments, getPaymentRequests } from '../../firebase/firestore'
import { formatCurrency } from '../../utils/helpers'
import StatCard from '../../components/ui/StatCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

import { SCHOOL_CLASSES } from '../../utils/helpers'

// Class order for sorting
const CLASS_ORDER = SCHOOL_CLASSES
const BAR_COLORS = ['#E86E07','#16377A','#095D30','#95BD0B','#FE7BA9','#6366f1',
                    '#14b8a6','#f97316','#ec4899','#84cc16','#06b6d4','#a855f7','#64748b','#e11d48']

export default function AdminDashboard() {
  const [students,  setStudents]  = useState([])
  const [employees, setEmployees] = useState([])
  const [payments,  setPayments]  = useState([])
  const [paymentRequests, setPaymentRequests] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, e, p, reqs] = await Promise.all([
        getStudents(), getEmployees(), getPayments(), getPaymentRequests(),
      ])
      setStudents(s)
      setEmployees(e)
      setPayments(p)
      setPaymentRequests(reqs)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!students.length && !employees.length) return null
    const now       = new Date()
    const mStart    = startOfMonth(now)
    const mEnd      = endOfMonth(now)

    const activeStudents = students.filter((s) => s.status !== 'inactive' && !s.leaveDate)
    const leftStudents   = students.filter((s) => !!s.leaveDate)
    const inactiveStudents = students.filter((s) => s.status === 'inactive' && !s.leaveDate)

    // Monthly collection: use approved payment_requests (new fee system)
    const approvedRequests = paymentRequests.filter((r) => r.status === 'Paid')
    const monthRequests    = approvedRequests.filter((r) => {
      const d = r.verifiedAt?.toDate ? r.verifiedAt.toDate()
              : r.submittedAt?.toDate ? r.submittedAt.toDate()
              : new Date(r.verifiedAt || r.submittedAt || 0)
      return isWithinInterval(d, { start: mStart, end: mEnd })
    })

    // Count active students who have at least one unpaid billing period
    // A student is "pending" if they have NO approved payment_request for the current month
    // OR they have never paid anything
    const approvedStudentIds = new Set(
      approvedRequests.map((r) => r.studentId)
    )
    const pendingFeeCount = activeStudents.filter((s) => {
      // Student is pending if they haven't had ANY approved payment
      return !approvedStudentIds.has(s.uid || s.id)
    }).length

    return {
      totalStudents:     students.length,
      activeStudents:    activeStudents.length,
      leftStudents:      leftStudents.length,
      inactiveStudents:  inactiveStudents.length,
      totalEmployees:    employees.length,
      pendingFees:       pendingFeeCount,
      monthlyCollection: monthRequests.reduce((s, r) => s + (r.totalAmount || 0), 0),
    }
  }, [students, employees, paymentRequests])

  // ── Students by class ────────────────────────────────────────────────────────
  const classCounts = useMemo(() => {
    const activeOnly = students.filter((s) => s.status !== 'inactive' && !s.leaveDate)
    const map = {}
    activeOnly.forEach((s) => {
      const cls = s.className || 'Unknown'
      map[cls] = (map[cls] || 0) + 1
    })
    // Sort by CLASS_ORDER, then unknowns alphabetically
    return CLASS_ORDER
      .filter((c) => map[c])
      .map((c) => ({ className: `Class ${c}`, count: map[c] }))
      .concat(
        Object.keys(map)
          .filter((k) => !CLASS_ORDER.includes(k))
          .sort()
          .map((k) => ({ className: k, count: map[k] }))
      )
  }, [students])

  // ── Monthly collection chart (last 6 months) ─────────────────────────────────
  const monthlyData = useMemo(() => {
    const now = new Date()
    // Use approved payment_requests for accurate collection data
    const approvedRequests = paymentRequests.filter((r) => r.status === 'Paid')
    return Array.from({ length: 6 }, (_, i) => {
      const d      = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const mStart = startOfMonth(d)
      const mEnd   = endOfMonth(d)
      const total  = approvedRequests
        .filter((r) => {
          const rd = r.verifiedAt?.toDate ? r.verifiedAt.toDate()
                   : r.submittedAt?.toDate ? r.submittedAt.toDate()
                   : new Date(r.verifiedAt || r.submittedAt || 0)
          return isWithinInterval(rd, { start: mStart, end: mEnd })
        })
        .reduce((s, r) => s + (r.totalAmount || 0), 0)
      return { month: format(d, 'MMM'), collection: total }
    })
  }, [paymentRequests])

  // ── Student status pie ────────────────────────────────────────────────────────
  // removed — student status graph no longer shown

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Students"     value={stats?.totalStudents}               icon={HiAcademicCap}   color="blue" />
        <StatCard title="Total Employees"    value={stats?.totalEmployees}              icon={HiUsers}         color="purple" />
        <StatCard
          title="Monthly Collection"
          value={formatCurrency(stats?.monthlyCollection)}
          icon={HiCalendar}
          color="indigo"
          subtitle={format(new Date(), 'MMMM yyyy')}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6">

        {/* Monthly Fee Collection — bar chart with direct numeric labels */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Monthly Fee Collection</h3>
          {monthlyData.every((d) => d.collection === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No fee collection data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="collection" name="Collection" radius={[6, 6, 0, 0]} fill="#E86E07">
                  <LabelList dataKey="collection"
                    position="top"
                    formatter={(v) => v > 0 ? `₹${(v/1000).toFixed(1)}k` : '—'}
                    style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Students by Class bar chart + table ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Bar chart */}
        <div className="lg:col-span-3 card p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Active Students by Class
          </h3>
          {classCounts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No active students</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classCounts} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="className" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {classCounts.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Class count table */}
        <div className="lg:col-span-2 card p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Class Strength
          </h3>
          {classCounts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No active students</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {classCounts.map(({ className, count }, i) => (
                <div key={className}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{className}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 px-3 border-t border-gray-100 dark:border-gray-800 mt-1">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Active</span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {classCounts.reduce((s, r) => s + r.count, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
