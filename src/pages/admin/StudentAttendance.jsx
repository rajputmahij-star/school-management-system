import React, { useState, useEffect, useMemo } from 'react'
import { HiSave, HiCalendar, HiTable, HiSearch } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { getStudents, getStudentAttendanceByClass, saveStudentAttendance, getStudentAttendance } from '../../firebase/firestore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { SCHOOL_CLASSES } from '../../utils/helpers'
import { ATTENDANCE_STATUSES, STATUS_MAP, normalizeStatus, calcAttendanceSummary } from '../../utils/attendanceConfig'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Status selector dropdown ─────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  const norm = normalizeStatus(value)
  const status = STATUS_MAP[norm]
  return (
    <select
      value={norm}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-semibold px-2 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${status?.badge || 'bg-gray-100 text-gray-600'}`}
    >
      {ATTENDANCE_STATUSES.map((s) => (
        <option key={s.code} value={s.code}>{s.short} — {s.label}</option>
      ))}
    </select>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ code }) {
  const s = STATUS_MAP[normalizeStatus(code)]
  if (!s) return null
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>{s.short} — {s.label}</span>
}

export default function AdminStudentAttendance() {
  const { userData } = useAuth()
  const now = new Date()
  const [tab, setTab] = useState('mark')

  // Mark state
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate,  setSelectedDate]  = useState(format(now, 'yyyy-MM-dd'))
  const [students,      setStudents]      = useState([])
  const [attendance,    setAttendance]    = useState({})   // { studentId: code }
  const [remarks,       setRemarks]       = useState({})   // { studentId: string }
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(false)
  const [saving,        setSaving]        = useState(false)

  // Summary state
  const [summaryClass,    setSummaryClass]    = useState('')
  const [summaryMonth,    setSummaryMonth]    = useState(now.getMonth() + 1)
  const [summaryYear,     setSummaryYear]     = useState(now.getFullYear())
  const [summaryData,     setSummaryData]     = useState([])
  const [filterStatus,    setFilterStatus]    = useState('all')
  const [loadingSummary,  setLoadingSummary]  = useState(false)

  useEffect(() => { if (selectedClass) loadClassData() }, [selectedClass, selectedDate])

  const loadClassData = async () => {
    setLoading(true)
    try {
      const allStudents   = await getStudents()
      const selectedDateObj = new Date(selectedDate + 'T00:00:00')
      const classStudents = allStudents.filter((s) => {
        if (s.className !== selectedClass || s.leaveDate) return false
        const startRaw = s.caseHistoryDate || s.admissionDate
        if (!startRaw) return true
        const startDate = startRaw?.toDate ? startRaw.toDate() : new Date(startRaw)
        return startDate <= selectedDateObj
      })
      classStudents.sort((a, b) => {
        const aR = a.caseHistoryDate || a.admissionDate
        const bR = b.caseHistoryDate || b.admissionDate
        const aD = aR?.toDate ? aR.toDate() : aR ? new Date(aR) : new Date(0)
        const bD = bR?.toDate ? bR.toDate() : bR ? new Date(bR) : new Date(0)
        return aD - bD
      })
      const existing = await getStudentAttendanceByClass(selectedClass, selectedDate)
      const attMap = {}
      const remMap = {}
      classStudents.forEach((s) => {
        const found = existing.find((a) => a.studentId === (s.uid || s.id))
        attMap[s.id] = found ? normalizeStatus(found.attendanceType) : 'P'
        remMap[s.id] = found?.remarks || ''
      })
      setStudents(classStudents)
      setAttendance(attMap)
      setRemarks(remMap)
    } catch (err) {
      toast.error(`Failed to load: ${err.message}`)
    } finally { setLoading(false) }
  }

  const loadSummary = async () => {
    if (!summaryClass) { toast.error('Select a class first'); return }
    setLoadingSummary(true)
    try {
      const allStudents = await getStudents()
      const monthEnd    = new Date(summaryYear, summaryMonth, 0, 23, 59, 59)
      const classStudents = allStudents.filter((s) => {
        if (s.className !== summaryClass || s.leaveDate) return false
        const startRaw = s.caseHistoryDate || s.admissionDate
        if (!startRaw) return true
        const d = startRaw?.toDate ? startRaw.toDate() : new Date(startRaw)
        return d <= monthEnd
      })
      const summaries = await Promise.all(classStudents.map(async (s) => {
        const sid     = s.uid || s.id
        const records = await getStudentAttendance(sid, summaryMonth, summaryYear)
        return { student: s, ...calcAttendanceSummary(records) }
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
    if (!selectedClass) { toast.error('Please select a class'); return }
    if (students.length === 0) { toast.error('No students to save'); return }
    setSaving(true)
    try {
      const records = filteredStudents.map((s) => ({
        studentId:      s.uid || s.id,
        studentName:    s.studentName,
        className:      selectedClass,
        date:           Timestamp.fromDate(new Date(selectedDate + 'T00:00:00')),
        dateStr:        selectedDate,
        attendanceType: attendance[s.id] || 'P',
        remarks:        remarks[s.id] || '',
        markedBy:       userData?.uid || userData?.id || '',
      }))
      await saveStudentAttendance(records)
      toast.success(`Attendance saved for ${selectedClass}`)
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally { setSaving(false) }
  }

  // Bulk actions
  const markAll = (code) => {
    const m = {}
    filteredStudents.forEach((s) => { m[s.id] = code })
    setAttendance((p) => ({ ...p, ...m }))
  }

  const filteredStudents = useMemo(() => {
    if (!search) return students
    const q = search.toLowerCase()
    return students.filter((s) =>
      s.studentName?.toLowerCase().includes(q) ||
      s.grNumber?.toLowerCase().includes(q) ||
      s.studentId?.toLowerCase().includes(q)
    )
  }, [students, search])

  // Daily counts
  const counts = useMemo(() => {
    const c = {}
    ATTENDANCE_STATUSES.forEach((s) => { c[s.code] = 0 })
    Object.values(attendance).forEach((v) => { if (v in c) c[v]++ })
    return c
  }, [attendance])

  const yearOptions = [now.getFullYear() - 1, now.getFullYear()]

  // Summary filter
  const filteredSummary = useMemo(() => {
    if (filterStatus === 'all') return summaryData
    return summaryData.filter((row) => {
      if (filterStatus === 'low') return row.pct < 75
      return true
    })
  }, [summaryData, filterStatus])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark or review student attendance</p>
        </div>
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          {[['mark','Mark Attendance'],['summary','Monthly Summary']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'mark' ? <HiCalendar className="w-4 h-4" /> : <HiTable className="w-4 h-4" />} {l}
            </button>
          ))}
        </div>
      </div>

      {/* ══ MARK TAB ══════════════════════════════════════════════════════════ */}
      {tab === 'mark' && (
        <>
          {/* Controls */}
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field w-40">
                <option value="">Select Class</option>
                {SCHOOL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input-field w-44" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label">Search Student</label>
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Name or GR number…" value={search}
                  onChange={(e) => setSearch(e.target.value)} className="input-field pl-9"
                  autoComplete="off" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !selectedClass || loading} className="btn-primary">
              {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />} Save
            </button>
          </div>

          {/* Status counts */}
          {selectedClass && !loading && (
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {ATTENDANCE_STATUSES.map((s) => (
                <div key={s.code} className="card p-2 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{counts[s.code] || 0}</p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.short}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bulk mark */}
          {selectedClass && !loading && filteredStudents.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-500">Mark all as:</span>
              {ATTENDANCE_STATUSES.filter((s) => !s.isHoliday).map((s) => (
                <button key={s.code} onClick={() => markAll(s.code)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${s.badge} hover:opacity-80 transition-opacity`}>
                  {s.short}
                </button>
              ))}
              <button onClick={() => markAll('H')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${STATUS_MAP['H'].badge} hover:opacity-80`}>
                H — Holiday
              </button>
            </div>
          )}

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
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header w-10">#</th>
                      <th className="table-header">Student</th>
                      <th className="table-header hidden sm:table-cell">GR No.</th>
                      <th className="table-header">Attendance</th>
                      <th className="table-header hidden md:table-cell">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell text-center text-gray-400 text-sm">{i + 1}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                              {s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{s.studentName?.[0]}</div>}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{s.studentName}</span>
                          </div>
                        </td>
                        <td className="table-cell hidden sm:table-cell text-sm text-gray-500">{s.grNumber}</td>
                        <td className="table-cell">
                          <StatusSelect value={attendance[s.id] || 'P'}
                            onChange={(v) => setAttendance((p) => ({ ...p, [s.id]: v }))} />
                        </td>
                        <td className="table-cell hidden md:table-cell">
                          <input type="text" value={remarks[s.id] || ''}
                            onChange={(e) => setRemarks((p) => ({ ...p, [s.id]: e.target.value }))}
                            placeholder="Optional remark…"
                            className="text-xs input-field py-1 w-32" autoComplete="off" />
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-12">
                        {students.length === 0 ? `No students in ${selectedClass}` : 'No students match search'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ SUMMARY TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'summary' && (
        <>
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Class</label>
              <select value={summaryClass} onChange={(e) => setSummaryClass(e.target.value)} className="input-field w-40">
                <option value="">Select Class</option>
                {SCHOOL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
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
            <div>
              <label className="label">Filter</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-36">
                <option value="all">All Students</option>
                <option value="low">Below 75%</option>
              </select>
            </div>
          </div>

          <div className="card overflow-hidden">
            {loadingSummary ? (
              <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
            ) : !summaryClass ? (
              <div className="p-12 text-center text-gray-400">Select a class to view the summary</div>
            ) : filteredSummary.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No records for {summaryClass} in {MONTHS[summaryMonth-1]} {summaryYear}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header">Student</th>
                      <th className="table-header text-center">P</th>
                      <th className="table-header text-center">A</th>
                      <th className="table-header text-center">L</th>
                      <th className="table-header text-center">HDF</th>
                      <th className="table-header text-center">HDS</th>
                      <th className="table-header text-center">LP</th>
                      <th className="table-header text-center">H</th>
                      <th className="table-header text-center">Working</th>
                      <th className="table-header text-center">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredSummary.map(({ student, P, A, L, HDF, HDS, LP, H, workingDays, pct }) => (
                      <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{student.studentName}</p>
                          <p className="text-xs text-gray-500">{student.grNumber}</p>
                        </td>
                        <td className="table-cell text-center text-green-600 font-semibold">{P}</td>
                        <td className="table-cell text-center text-red-500 font-semibold">{A}</td>
                        <td className="table-cell text-center text-blue-500 font-semibold">{L}</td>
                        <td className="table-cell text-center text-orange-500 font-semibold">{HDF}</td>
                        <td className="table-cell text-center text-amber-500 font-semibold">{HDS}</td>
                        <td className="table-cell text-center text-purple-500 font-semibold">{LP}</td>
                        <td className="table-cell text-center text-gray-400 font-semibold">{H}</td>
                        <td className="table-cell text-center text-gray-600 dark:text-gray-400">{workingDays}</td>
                        <td className="table-cell text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${pct >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-500'}`}>{pct}%</span>
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
