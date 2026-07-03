import React, { useState, useEffect } from 'react'
import { HiSave, HiCalendar, HiTable } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import {
  getStudents, getStudentAttendanceByClass, saveStudentAttendance,
  getStudentAttendance,
} from '../../firebase/firestore'
import { calculateAttendancePercent } from '../../utils/helpers'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { SCHOOL_CLASSES } from '../../utils/helpers'

const CLASSES = SCHOOL_CLASSES
const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function AdminStudentAttendance() {
  const { userData } = useAuth()
  const now = new Date()

  const [tab, setTab] = useState('mark')

  // Mark attendance state
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate,  setSelectedDate]  = useState(format(now, 'yyyy-MM-dd'))
  const [students,      setStudents]      = useState([])
  const [attendance,    setAttendance]    = useState({})
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)

  // Summary state
  const [summaryClass, setSummaryClass] = useState('')
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1)
  const [summaryYear,  setSummaryYear]  = useState(now.getFullYear())
  const [summaryData,  setSummaryData]  = useState([])
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    if (selectedClass) loadClassData()
  }, [selectedClass, selectedDate])

  const loadClassData = async () => {
    setLoading(true)
    try {
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
      toast.error(`Failed to load: ${err.message}`)
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

  const handleSave = async () => {
    if (!selectedClass)       { toast.error('Please select a class'); return }
    if (students.length === 0) { toast.error('No students to save'); return }
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
      toast.success(`Attendance saved for ${selectedClass}`)
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally { setSaving(false) }
  }

  const presentCount = Object.values(attendance).filter((v) => v === 'Present').length
  const absentCount  = Object.values(attendance).filter((v) => v === 'Absent').length
  const yearOptions  = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark or review student attendance</p>
        </div>
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          <button onClick={() => setTab('mark')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'mark' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <HiCalendar className="w-4 h-4" /> Mark Attendance
          </button>
          <button onClick={() => setTab('summary')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <HiTable className="w-4 h-4" /> Monthly Summary
          </button>
        </div>
      </div>

      {tab === 'mark' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="card p-4 flex flex-wrap gap-4 flex-1">
              <div>
                <label className="label">Class</label>
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field w-36">
                  <option value="">Select Class</option>
                  {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
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
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{s.studentName?.[0]}</div>}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{s.studentName}</span>
                          </div>
                        </td>
                        <td className="table-cell text-gray-500">{s.grNumber}</td>
                        <td className="table-cell">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => setAttendance((p) => ({ ...p, [s.id]: 'Present' }))}
                              className={`w-24 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'Present' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-green-50'}`}>
                              ✓ Present
                            </button>
                            <button onClick={() => setAttendance((p) => ({ ...p, [s.id]: 'Absent' }))}
                              className={`w-24 py-1.5 rounded-lg text-xs font-medium transition-all ${attendance[s.id] === 'Absent' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-50'}`}>
                              ✗ Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-12">No students in {selectedClass}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'summary' && (
        <>
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Class</label>
              <select value={summaryClass} onChange={(e) => setSummaryClass(e.target.value)} className="input-field w-36">
                <option value="">Select Class</option>
                {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
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
              <div className="p-12 text-center text-gray-400">No records for {summaryClass} in {MONTHS[summaryMonth - 1]} {summaryYear}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header">Student</th>
                      <th className="table-header text-center">Present</th>
                      <th className="table-header text-center">Absent</th>
                      <th className="table-header text-center">Total</th>
                      <th className="table-header text-center">%</th>
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
                              <div className={`h-1.5 rounded-full ${percent >= 75 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
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
    </div>
  )
}
