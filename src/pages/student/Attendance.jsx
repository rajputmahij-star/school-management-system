import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getStudentAttendance, getStudentLeaves } from '../../firebase/firestore'
import AttendanceCalendar from '../../components/ui/AttendanceCalendar'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { addMonths, subMonths, parseISO } from 'date-fns'
import { ATTENDANCE_STATUSES, STATUS_MAP, normalizeStatus, calcAttendanceSummary } from '../../utils/attendanceConfig'

export default function StudentAttendanceView() {
  const { userData } = useAuth()
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [records, setRecords]             = useState([])
  const [loading, setLoading]             = useState(false)

  useEffect(() => {
    const uid = userData?.uid || userData?.id
    if (uid) loadData(uid)
  }, [userData, calendarMonth])

  const loadData = async (uid) => {
    setLoading(true)
    try {
      const month = calendarMonth.getMonth() + 1
      const year  = calendarMonth.getFullYear()
      const [attendance, leaves] = await Promise.all([
        getStudentAttendance(uid, month, year),
        getStudentLeaves(uid),
      ])
      const map = {}
      attendance.forEach((r) => { if (r.dateStr) map[r.dateStr] = r })
      leaves.forEach((leave) => {
        ;(leave.dates || []).forEach((dateStr) => {
          try {
            const d = parseISO(dateStr)
            if (d.getMonth() + 1 === month && d.getFullYear() === year) {
              if (!map[dateStr]) map[dateStr] = { dateStr, attendanceType: 'L', studentId: uid }
            }
          } catch (_) {}
        })
      })
      setRecords(Object.values(map))
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally { setLoading(false) }
  }

  // Summary calculations
  const summary = calcAttendanceSummary(records)

  const summaryItems = [
    { label: 'Present',                 value: summary.P,            color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Absent',                  value: summary.A,            color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Leave',                   value: summary.L,            color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Half Day (First Half)',   value: summary.HDF,          color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Half Day (Second Half)',  value: summary.HDS,          color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Late Present',            value: summary.LP,           color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Holiday',                 value: summary.H,            color: 'text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-800' },
    { label: 'Working Days',            value: summary.workingDays,  color: 'text-gray-700 dark:text-gray-200', bg: 'bg-gray-50 dark:bg-gray-800' },
    { label: 'Attendance %',            value: `${summary.pct}%`,    color: summary.pct >= 75 ? 'text-green-600' : 'text-red-500', bg: summary.pct >= 75 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monthly attendance calendar and summary</p>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {summaryItems.map(({ label, value, color, bg }) => (
          <div key={label} className={`card p-3 text-center ${bg}`}>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Color Legend */}
      <div className="card p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Legend</p>
        <div className="flex flex-wrap gap-3">
          {ATTENDANCE_STATUSES.map((s) => (
            <div key={s.code} className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded-sm ${s.color} flex items-center justify-center`}>
                <span className="text-[8px] text-white font-bold">{s.short}</span>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      {loading
        ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
        : <AttendanceCalendar
            records={records}
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
          />
      }
    </div>
  )
}
