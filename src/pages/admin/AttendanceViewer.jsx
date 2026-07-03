import React, { useState, useEffect, useCallback } from 'react'
import { HiEye, HiX, HiUsers, HiAcademicCap } from 'react-icons/hi'
import {
  getEmployees, getStudents,
  getEmployeeAttendance, getStudentAttendance,
} from '../../firebase/firestore'
import AttendanceCalendar from '../../components/ui/AttendanceCalendar'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { addMonths, subMonths } from 'date-fns'
import { SCHOOL_CLASSES } from '../../utils/helpers'

// ── Compact attendance modal ──────────────────────────────────────────────────
function AttendanceModal({ name, records, loading, onClose }) {
  const [month, setMonth] = useState(new Date())

  const monthRecords = records.filter((r) => {
    const d = r.date?.toDate ? r.date.toDate() : new Date(r.dateStr + 'T00:00:00')
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">{name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <HiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4">
          {loading
            ? <div className="flex justify-center p-8"><LoadingSpinner size="lg" /></div>
            : <AttendanceCalendar
                records={monthRecords}
                month={month}
                onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
                onNextMonth={() => setMonth((m) => addMonths(m, 1))}
              />
          }
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminAttendanceViewer() {
  const [tab,        setTab]       = useState('employee')
  const [employees,  setEmployees] = useState([])
  const [students,   setStudents]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [selectedClass, setSelectedClass] = useState('')

  // Modal state
  const [modal,        setModal]        = useState(null) // { name, records }
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => { loadPeople() }, [])

  const loadPeople = async () => {
    try {
      setLoading(true)
      const [emps, studs] = await Promise.all([getEmployees(), getStudents()])
      setEmployees(emps.filter((e) => !e.leaveDate))
      setStudents(studs.filter((s) => !s.leaveDate))
    } catch (err) {
      toast.error(`Failed to load: ${err.message}`)
    } finally { setLoading(false) }
  }

  const openEmployeeAttendance = async (emp) => {
    setModal({ name: emp.employeeName, records: [] })
    setModalLoading(true)
    try {
      // Load all months (last 12)
      const now = new Date()
      const allRecords = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const recs = await getEmployeeAttendance(emp.uid || emp.id, d.getMonth() + 1, d.getFullYear())
        allRecords.push(...recs)
      }
      setModal({ name: emp.employeeName, records: allRecords })
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally { setModalLoading(false) }
  }

  const openStudentAttendance = async (student) => {
    setModal({ name: student.studentName, records: [] })
    setModalLoading(true)
    try {
      const now = new Date()
      const allRecords = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const recs = await getStudentAttendance(student.uid || student.id, d.getMonth() + 1, d.getFullYear())
        allRecords.push(...recs)
      }
      setModal({ name: student.studentName, records: allRecords })
    } catch (err) {
      toast.error('Failed to load attendance')
    } finally { setModalLoading(false) }
  }

  const classStudents = selectedClass
    ? students.filter((s) => s.className === selectedClass)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Viewer</h1>
        <p className="text-sm text-gray-500 mt-0.5">View attendance calendars for employees and students</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('employee')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'employee' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          <HiUsers className="w-4 h-4" /> Employee Attendance
        </button>
        <button onClick={() => setTab('student')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'student' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          <HiAcademicCap className="w-4 h-4" /> Student Attendance
        </button>
      </div>

      {/* ── Employee tab ── */}
      {tab === 'employee' && (
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          : employees.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No active employees</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="table-header">Employee</th>
                    <th className="table-header hidden sm:table-cell">Designation</th>
                    <th className="table-header hidden md:table-cell">Class</th>
                    <th className="table-header">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                            {emp.photo ? <img src={emp.photo} alt="" className="w-full h-full object-cover rounded-full" /> : emp.employeeName?.[0]}
                          </div>
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{emp.employeeName}</p>
                        </div>
                      </td>
                      <td className="table-cell hidden sm:table-cell"><span className="badge-info">{emp.designation}</span></td>
                      <td className="table-cell hidden md:table-cell text-sm text-gray-500">{emp.assignedClass || '—'}</td>
                      <td className="table-cell">
                        <button onClick={() => openEmployeeAttendance(emp)}
                          className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium">
                          <HiEye className="w-4 h-4" /> View Attendance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Student tab ── */}
      {tab === 'student' && (
        <>
          <div className="card p-4 flex items-end gap-4">
            <div>
              <label className="label">Select Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field w-44">
                <option value="">— Select Class —</option>
                {SCHOOL_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {selectedClass && (
            <div className="card overflow-hidden">
              {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
              : classStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No students in {selectedClass}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="table-header">Student</th>
                        <th className="table-header hidden sm:table-cell">GR No.</th>
                        <th className="table-header">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {classStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                                {s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover rounded-full" /> : s.studentName?.[0]}
                              </div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{s.studentName}</p>
                            </div>
                          </td>
                          <td className="table-cell hidden sm:table-cell text-sm text-gray-500">{s.grNumber}</td>
                          <td className="table-cell">
                            <button onClick={() => openStudentAttendance(s)}
                              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium">
                              <HiEye className="w-4 h-4" /> View Attendance
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Attendance modal */}
      {modal && (
        <AttendanceModal
          name={modal.name}
          records={modal.records}
          loading={modalLoading}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
