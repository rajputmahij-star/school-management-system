import React, { useState, useEffect } from 'react'
import { HiSave, HiCalendar, HiTable, HiViewGrid } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import {
  getStudents, getStudentAttendanceByClass, saveStudentAttendance,
  getStudentAttendance, getStudentLeaves,
} from '../../firebase/firestore'
import { calculateAttendancePercent } from '../../utils/helpers'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AttendanceCalendar from '../../components/ui/AttendanceCalendar'
import toast from 'react-hot-toast'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { SCHOOL_CLASSES } from '../../utils/helpers'

const CLASSES = SCHOOL_CLASSES
const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function StudentAttendancePage() {
  const { userData } = useAuth()
  const now = new Date()

  // tab: 'mark' | 'summary' | 'calendars'
  const [tab, setTab] = useState('mark')

  // ── Mark attendance ──────────────────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate,  setSelectedDate]  = useState(format(now, 'yyyy-MM-dd'))
  const [students,      setStudents]      = useState([])
  const [attendance,    setAttendance]    = useState({})
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)

  // ── Monthly summary ──────────────────────────────────────────────────────
  const [summaryClass,    setSummaryClass]    = useState('')
  const [summaryMonth,    setSummaryMonth]    = useState(now.getMonth() + 1)
  const [summaryYear,     setSummaryYear]     = useState(now.getFullYear())
  const [summaryData,     setSummaryData]     = useState([])
  const [loadingSummary,  setLoadingSummary]  = useState(false)

  // ── Attendance calendars ─────────────────────────────────────────────────
  const [calClass,      setCalClass]      = useState('')
  const [calStudents,   setCalStudents]   = useState([])
  const [calMonth,      setCalMonth]      = useState(new Date())
  const [calRecordsMap, setCalRecordsMap] = useState({}) // uid → records[]
  const [loadingCal,    setLoadingCal]    = useState(false)

  // Only teaching staff can access
  const TEACHING_ROLES = ['Educator', 'Special Educator', 'Assistant Educator', 'Co-ordinator', 'Principal']
  if (!TEACHING_ROLES.includes(userData?.designation)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm mt-1">Only Educators can mark student attendance</p>
      </div>
    )
  }

  const assignedClass      = userData?.assignedClass || ''
  const hasClassRestriction = !!assignedClass

  // Auto-select assigned class on mount
  useEffect(() => {
    if (hasClassRestriction && !selectedClass) {
      setSelectedClass(assignedClass)
      setSummaryClass(assignedClass)
      setCalClass(assignedClass)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedClass])

  useEffect(() => {
    if (selectedClass) loadClassData()
  }, [selectedClass, selectedDate])

  const loadClassData = async () => {
    try {
      setLoading(true)
      const allStudents   = await getStudents()
      const classStudents = allStudents.filter((s) => s.className === selectedClass && !s.leaveDate)
      const existing      = await getStudentAttendanceByClass(selectedClass, selectedDate)
      const map = {}
      classStudents.forEach((s) => {
        const found = existing.find((a) => a.studentId === (s.uid || s.id))
        map[s.id] = found?.attendanceType || 'Present'
      })
      setStudents(classStudents)
      setAttendance(map)
    } catch (err) {
      toast.error(`Failed to load students: ${err.message}`)
    } finally { setLoading(false) }
  }

  const loadSummary = async () => {
    if (!summaryClass) { toast.error('Select a class first'); return }
    setLoadingSummary(true)
    try {
      const allStudents   = await getStudents()
      const classStudents = allStudents.filter((s) => s.className === summaryClass && !s.leaveDate)
      const summaries = await Promise.all(classStudents.map(async (s) => {
        const sid     = s.uid || s.id
        const records = await getStudentAttendance(sid, summaryMonth, summaryYear)
        const presentDays = records.filter((r) => r.attendanceType === 'Present').length
        const absentDays  = records.filter((r) => r.attendanceType === 'Absent').length
        const totalDays   = records.length
        const percent     = calculateAttendancePercent(presentDays, totalDays)
        return { student: s, presentDays, absentDays, totalDays, percent }
      }))
      setSummaryData(summaries)
    } catch (err) {
      toast.error(`Failed to load summary: ${err.message}`)
    } finally { setLoadingSummary(false) }
  }

  useEffect(() => {
    if (tab === 'summary' && summaryClass) loadSummary()
  }, [tab, summaryClass, summaryMonth, summaryYear])

  // Load attendance calendars (with leave overlay) for the class
  const loadCalendars = async () => {
    if (!calClass) return
    setLoadingCal(true)
    try {
      const month = calMonth.getMonth() + 1
      const year  = calMonth.getFullYear()

      const allStudents   = await getStudents()
      const classStudents = allStudents.filter((s) => s.className === calClass && !s.leaveDate)
      setCalStudents(classStudents)

      const entries = await Promise.all(classStudents.map(async (s) => {
        const sid = s.uid || s.id
        const [attRecords, leaves] = await Promise.all([
          getStudentAttendance(sid, month, year),
          getStudentLeaves(sid),
        ])
        // Build map from attendance records
        const map = {}
        attRecords.forEach((r) => { if (r.dateStr) map[r.dateStr] = r })
        // Overlay leave dates (only current month, only if not already marked Present/Absent)
        leaves.forEach((leave) => {
          ;(leave.dates || []).forEach((dateStr) => {
            try {
              const d = parseISO(dateStr)
              if (d.getMonth() + 1 === month && d.getFullYear() === year) {
                if (!map[dateStr] || map[dateStr].attendanceType === 'Leave') {
                  map[dateStr] = { dateStr, attendanceType: 'Leave', studentId: sid }
                }
              }
            } catch (_) {}
          })
        })
        return [sid, Object.values(map)]
      }))

      const newMap = {}
      entries.forEach(([sid, recs]) => { newMap[sid] = recs })
      setCalRecordsMap(newMap)
    } catch (err) {
      toast.error(`Failed to load calendars: ${err.message}`)
    } finally { setLoadingCal(false) }
  }

  useEffect(() => {
    if (tab === 'calendars' && calClass) loadCalendars()
  }, [tab, calClass, calMonth])

  const handleSave = async () => {
    if (!selectedClass)       { toast.error('Please select a class'); return }
    if (students.length === 0) { toast.error('No students to save attendance for'); return }
    setSaving(true)
    try {
      const records = students.map((s) => ({
        studentId:      s.uid || s.id,
        studentName:    s.studentName,
        className:      selectedClass,
        date:           Timestamp.fromDate(new Date(selectedDate + 'T00:00:00')),
        dateStr:        selectedDate,
        attendanceType: attendance[s.id] || 'Present',
        markedBy:       userData?.uid || userData?.id || '',
      }))
      await saveStudentAttendance(records)
      toast.success(`Attendance saved for Class ${selectedClass}`)
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally { setSaving(false) }
  }

  const presentCount = Object.values(attendance).filter((v) => v === 'Present').length
  const absentCount  = Object.values(attendance).filter((v) => v === 'Absent').length
  const yearOptions  = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6">
      {/* Header + Tab switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark attendance or view monthly summaries and calendars</p>
        </div>
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          <button onClick={() => setTab('mark')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'mark' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <HiCalendar className="w-4 h-4" /> Mark Attendance
          </button>
          <button onClick={() => setTab('summary')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <HiTable className="w-4 h-4" /> Monthly Summary
          </button>
          <button onClick={() => setTab('calendars')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'calendars' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <HiViewGrid className="w-4 h-4" /> Attendance Calendars
          </button>
        </div>
      </div>

      {/* ══ MARK ATTENDANCE TAB ══════════════════════════════════════════════ */}
      {tab === 'mark' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="card p-4 flex flex-wrap gap-4 flex-1">
              <div>
                <label className="label">Class</label>
                {hasClassRestriction ? (
                  <div className="input-field w-36 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center">
                    {assignedClass}
                  </div>
                ) : (
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field w-36">
                    <option value="">Select Class</option>
                    {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Date</label>
                <div className="relative">
                  <HiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input-field pl-9 w-44" />
                </div>
              </div>
              {selectedClass && !loading && (
                <div className="flex items-end gap-3">
                  <div className="text-center px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{presentCount}</p>
                    <p className="text-xs text-green-600">Present</p>
                  </div>
                  <div className="text-center px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-lg font-bold text-red-500">{absentCount}</p>
                    <p className="text-xs text-red-500">Absent</p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleSave} disabled={saving || !selectedClass || loading} className="btn-primary self-end sm:self-auto">
              {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
              Save Attendance
            </button>
          </div>

          {!selectedClass ? (
            <div className="card p-12 text-center text-gray-400">
              <HiCalendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a class to mark attendance</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header w-10">#</th>
                      <th className="table-header">Student</th>
                      <th className="table-header">GR No.</th>
                      <th className="table-header text-center">Mark Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {students.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell text-center text-gray-400">{i + 1}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                              {s.photo
                                ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{s.studentName?.[0]}</div>
                              }
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{s.studentName}</span>
                          </div>
                        </td>
                        <td className="table-cell text-gray-500">{s.grNumber}</td>
                        <td className="table-cell">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setAttendance((p) => ({ ...p, [s.id]: 'Present' }))}
                              className={`w-24 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'Present' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                              ✓ Present
                            </button>
                            <button onClick={() => setAttendance((p) => ({ ...p, [s.id]: 'Absent' }))}
                              className={`w-24 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'Absent' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                              ✗ Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-12">No students in Class {selectedClass}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ MONTHLY SUMMARY TAB ══════════════════════════════════════════════ */}
      {tab === 'summary' && (
        <>
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Class</label>
              {hasClassRestriction ? (
                <div className="input-field w-36 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center">
                  {assignedClass}
                </div>
              ) : (
                <select value={summaryClass} onChange={(e) => setSummaryClass(e.target.value)} className="input-field w-36">
                  <option value="">Select Class</option>
                  {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="label">Month</label>
              <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="input-field w-36">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select value={summaryYear} onChange={(e) => setSummaryYear(Number(e.target.value))} className="input-field w-28">
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="card overflow-hidden">
            {loadingSummary ? (
              <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
            ) : !summaryClass ? (
              <div className="p-12 text-center text-gray-400">Select a class to view the summary</div>
            ) : summaryData.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No records for Class {summaryClass} in {MONTHS[summaryMonth - 1]} {summaryYear}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header">Student</th>
                      <th className="table-header text-center">Present Days</th>
                      <th className="table-header text-center">Absent Days</th>
                      <th className="table-header text-center">Total Days Marked</th>
                      <th className="table-header text-center">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {summaryData.map(({ student, presentDays, absentDays, totalDays, percent }) => (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{student.studentName}</p>
                          <p className="text-xs text-gray-500">{student.grNumber}</p>
                        </td>
                        <td className="table-cell text-center"><span className="text-green-600 font-semibold">{presentDays}</span></td>
                        <td className="table-cell text-center"><span className="text-red-500 font-semibold">{absentDays}</span></td>
                        <td className="table-cell text-center text-gray-600 dark:text-gray-400">{totalDays}</td>
                        <td className="table-cell text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${percent >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(percent, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${percent >= 75 ? 'text-green-600' : 'text-red-500'}`}>{percent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ ATTENDANCE CALENDARS TAB ═════════════════════════════════════════ */}
      {tab === 'calendars' && (
        <>
          {/* Class + Month selector */}
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Class</label>
              {hasClassRestriction ? (
                <div className="input-field w-36 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center">
                  {assignedClass}
                </div>
              ) : (
                <select value={calClass} onChange={(e) => setCalClass(e.target.value)} className="input-field w-36">
                  <option value="">Select Class</option>
                  {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="label">Month</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCalMonth((m) => subMonths(m, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold">‹</button>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 w-28 text-center">
                  {format(calMonth, 'MMMM yyyy')}
                </span>
                <button type="button" onClick={() => setCalMonth((m) => addMonths(m, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 font-bold">›</button>
              </div>
            </div>
          </div>

          {!calClass ? (
            <div className="card p-12 text-center text-gray-400">
              <HiViewGrid className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a class to view attendance calendars</p>
            </div>
          ) : loadingCal ? (
            <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          ) : calStudents.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">No students in Class {calClass}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {calStudents.map((s) => {
                const sid = s.uid || s.id
                return (
                  <div key={s.id} className="card p-3">
                    {/* Student name header */}
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                        {s.photo
                          ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                          : s.studentName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{s.studentName}</p>
                        <p className="text-[10px] text-gray-400">GR: {s.grNumber}</p>
                      </div>
                    </div>
                    <AttendanceCalendar
                      records={calRecordsMap[sid] || []}
                      month={calMonth}
                      onPrevMonth={() => setCalMonth((m) => subMonths(m, 1))}
                      onNextMonth={() => setCalMonth((m) => addMonths(m, 1))}
                      studentMode={true}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
