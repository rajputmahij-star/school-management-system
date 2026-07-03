import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getStudentAttendance, getStudentLeaves } from '../../firebase/firestore'
import AttendanceCalendar from '../../components/ui/AttendanceCalendar'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { addMonths, subMonths, format, parseISO } from 'date-fns'

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

      // Fetch both attendance records and leave notifications in parallel
      const [attendance, leaves] = await Promise.all([
        getStudentAttendance(uid, month, year),
        getStudentLeaves(uid),
      ])

      // Build a map from existing attendance records (dateStr → record)
      const map = {}
      attendance.forEach((r) => { if (r.dateStr) map[r.dateStr] = r })

      // Overlay approved leave days — only for dates in the current month view
      // that don't already have an attendance record marked as Present/Absent
      leaves.forEach((leave) => {
        const dates = leave.dates || []
        dates.forEach((dateStr) => {
          // Only apply if in current month view
          try {
            const d = parseISO(dateStr)
            if (d.getMonth() + 1 === month && d.getFullYear() === year) {
              // Only overlay if no record exists or the existing record is already Leave
              if (!map[dateStr] || map[dateStr].attendanceType === 'Leave') {
                map[dateStr] = {
                  dateStr,
                  attendanceType: 'Leave',
                  studentId: uid,
                }
              }
            }
          } catch (_) {}
        })
      })

      setRecords(Object.values(map))
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">View your monthly attendance calendar</p>
      </div>

      {loading
        ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
        : <AttendanceCalendar
            records={records}
            month={calendarMonth}
            onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
            studentMode={true}
          />
      }
    </div>
  )
}
