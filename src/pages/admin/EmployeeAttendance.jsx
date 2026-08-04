import React, { useState, useEffect, useMemo } from 'react'
import { HiSave, HiCalendar, HiTable } from 'react-icons/hi'
import {
  getEmployees,
  getAllEmployeeAttendanceByDate,
  getAllEmployeeAttendanceByMonth,
  saveEmployeeAttendance,
} from '../../firebase/firestore'
import { formatDate, formatCurrency, calculateSalaryFromAttendance } from '../../utils/helpers'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { ATTENDANCE_STATUSES, STATUS_MAP, normalizeStatus, calcAttendanceSummary } from '../../utils/attendanceConfig'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function EmployeeAttendancePage() {
  const now = new Date()

  // ── Tab: 'daily' | 'monthly' ────────────────────────────────────────────────
  const [tab, setTab] = useState('daily')

  // ── Daily mark state ────────────────────────────────────────────────────────
  const [employees, setEmployees]   = useState([])
  const [attendance, setAttendance] = useState({})
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [saving, setSaving]         = useState(false)
  const [selectedDate, setSelectedDate] = useState(format(now, 'yyyy-MM-dd'))

  // ── Monthly summary state ───────────────────────────────────────────────────
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1) // 1-12
  const [summaryYear,  setSummaryYear]  = useState(now.getFullYear())
  const [monthRecords, setMonthRecords] = useState([])
  const [loadingMonth, setLoadingMonth] = useState(false)

  // Load daily data whenever selectedDate changes
  useEffect(() => { loadDaily() }, [selectedDate])

  // Load monthly summary whenever month/year changes (only when on summary tab)
  useEffect(() => {
    if (tab === 'monthly') loadMonthly()
  }, [summaryMonth, summaryYear, tab])

  // ── Daily load ──────────────────────────────────────────────────────────────
  const loadDaily = async () => {
    try {
      setLoadingDaily(true)
      const [emps, existing] = await Promise.all([
        getEmployees(),
        getAllEmployeeAttendanceByDate(new Date(selectedDate + 'T00:00:00')),
      ])
      const selectedDateObj = new Date(selectedDate + 'T00:00:00')
      // Only show employees who had joined on or before the selected date
      const active = emps.filter((e) => {
        if (e.leaveDate) return false
        if (!e.joiningDate) return true
        const joined = e.joiningDate?.toDate ? e.joiningDate.toDate() : new Date(e.joiningDate)
        return joined <= selectedDateObj
      })
      // Sort by Joining Date ascending
      active.sort((a, b) => {
        const aDate = a.joiningDate?.toDate ? a.joiningDate.toDate() : a.joiningDate ? new Date(a.joiningDate) : new Date(0)
        const bDate = b.joiningDate?.toDate ? b.joiningDate.toDate() : b.joiningDate ? new Date(b.joiningDate) : new Date(0)
        return aDate - bDate
      })
      const map = {}
      active.forEach((e) => {
        const found = existing.find((a) => a.employeeId === e.id)
        map[e.id] = found ? normalizeStatus(found.attendanceType) : 'P'
      })
      setEmployees(active)
      setAttendance(map)
    } catch (err) {
      toast.error(`Failed to load attendance: ${err.message}`)
    } finally {
      setLoadingDaily(false)
    }
  }

  // ── Monthly load ────────────────────────────────────────────────────────────
  const loadMonthly = async () => {
    try {
      setLoadingMonth(true)
      const [emps, records] = await Promise.all([
        getEmployees(),
        getAllEmployeeAttendanceByMonth(summaryMonth, summaryYear),
      ])
      // Only show employees who had joined by end of the selected month
      const monthEnd = new Date(summaryYear, summaryMonth, 0, 23, 59, 59)
      const active = emps.filter((e) => {
        if (e.leaveDate) return false
        if (!e.joiningDate) return true
        const joined = e.joiningDate?.toDate ? e.joiningDate.toDate() : new Date(e.joiningDate)
        return joined <= monthEnd
      })
      // Sort by Joining Date ascending
      active.sort((a, b) => {
        const aDate = a.joiningDate?.toDate ? a.joiningDate.toDate() : a.joiningDate ? new Date(a.joiningDate) : new Date(0)
        const bDate = b.joiningDate?.toDate ? b.joiningDate.toDate() : b.joiningDate ? new Date(b.joiningDate) : new Date(0)
        return aDate - bDate
      })
      setEmployees(active)
      setMonthRecords(records)
    } catch (err) {
      toast.error(`Failed to load monthly data: ${err.message}`)
    } finally {
      setLoadingMonth(false)
    }
  }

  // ── Save daily attendance ───────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const records = employees.map((emp) => ({
        employeeId:     emp.id,
        employeeName:   emp.employeeName,
        designation:    emp.designation,
        date:           Timestamp.fromDate(new Date(selectedDate + 'T00:00:00')),
        dateStr:        selectedDate,
        attendanceType: normalizeStatus(attendance[emp.id] || 'P'),
      }))
      await saveEmployeeAttendance(records)
      toast.success('Attendance saved successfully')
    } catch (err) {
      toast.error(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Daily summary counts ────────────────────────────────────────────────────
  const dailyCounts = useMemo(() => {
    const c = {}
    ATTENDANCE_STATUSES.forEach((s) => { c[s.code] = 0 })
    employees.forEach((e) => {
      const code = normalizeStatus(attendance[e.id] || 'P')
      if (code in c) c[code]++
    })
    return c
  }, [employees, attendance])

  // ── Monthly summary rows ─────────────────────────────────────────────────────
  const monthlySummary = useMemo(() => {
    return employees.map((emp) => {
      const empRecs = monthRecords.filter((r) => r.employeeId === emp.id)
      const summary = calcAttendanceSummary(empRecs)
      // For salary: P + LP = full day, HDF + HDS = half day
      const presentDays = summary.P + summary.LP
      const halfDays    = summary.HDF + summary.HDS

      const { perDaySalary, salaryEarned, attendancePct } = calculateSalaryFromAttendance(
        emp.monthlySalary, summaryMonth, summaryYear, presentDays, halfDays
      )

      return {
        id:           emp.id,
        employeeName: emp.employeeName,
        designation:  emp.designation,
        monthlySalary: emp.monthlySalary,
        ...summary,
        perDaySalary,
        salaryEarned,
        attendancePct,
      }
    })
  }, [employees, monthRecords, summaryMonth, summaryYear])

  const isSunday = new Date(selectedDate + 'T00:00:00').getDay() === 0
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark attendance for any selected date.</p>
        </div>
        {/* Tab switcher */}
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setTab('daily')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'daily'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <HiCalendar className="w-4 h-4" /> Daily Mark
          </button>
          <button
            onClick={() => setTab('monthly')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <HiTable className="w-4 h-4" /> Monthly Summary
          </button>
        </div>
      </div>

      {/* ══ DAILY TAB ══════════════════════════════════════════════════════════ */}
      {tab === 'daily' && (
        <>
          {/* Date picker + Save */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <HiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field pl-9 w-44"
              />
            </div>
            {isSunday && (
              <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1.5 rounded-full font-medium">
                Sunday
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loadingDaily}
              className="btn-primary"
            >
              {saving ? <LoadingSpinner size="sm" /> : <HiSave className="w-4 h-4" />}
              Save Attendance
            </button>
          </div>

          {/* Daily summary cards */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {ATTENDANCE_STATUSES.map((s) => (
              <div key={s.code} className="card p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{dailyCounts[s.code] || 0}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{s.short}</span>
              </div>
            ))}
          </div>

          {/* Attendance table */}
          <div className="card overflow-hidden">
            {loadingDaily ? (
              <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header w-10">#</th>
                      <th className="table-header">Employee</th>
                      <th className="table-header">Designation</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {employees.length === 0 ? (
                      <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-12">No active employees</td></tr>
                    ) : employees.map((emp, i) => (
                      <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell text-gray-400 text-center">{i + 1}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                              {emp.photo
                                ? <img src={emp.photo} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{emp.employeeName?.[0]}</div>
                              }
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{emp.employeeName}</span>
                          </div>
                        </td>
                        <td className="table-cell"><span className="badge-info">{emp.designation}</span></td>
                        <td className="table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {ATTENDANCE_STATUSES.map((s) => (
                              <button
                                key={s.code}
                                onClick={() => setAttendance((prev) => ({ ...prev, [emp.id]: s.code }))}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                                  normalizeStatus(attendance[emp.id] || 'P') === s.code
                                    ? `${s.badge} ring-2 ring-offset-1 ring-current`
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                              >
                                {s.short}
                              </button>
                            ))}
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

      {/* ══ MONTHLY SUMMARY TAB ═══════════════════════════════════════════════ */}
      {tab === 'monthly' && (
        <>
          {/* Month / Year selectors */}
          <div className="card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Month</label>
              <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="input-field w-40">
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

          {/* Summary table */}
          <div className="card overflow-hidden">
            {loadingMonth ? (
              <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="table-header">Employee</th>
                      <th className="table-header">Designation</th>
                      <th className="table-header text-center text-green-600">P</th>
                      <th className="table-header text-center text-red-500">A</th>
                      <th className="table-header text-center text-blue-500">L</th>
                      <th className="table-header text-center text-orange-500">HDF</th>
                      <th className="table-header text-center text-amber-500">HDS</th>
                      <th className="table-header text-center text-purple-500">LP</th>
                      <th className="table-header text-center text-gray-400">H</th>
                      <th className="table-header text-center">%</th>
                      <th className="table-header text-right">Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {monthlySummary.length === 0 ? (
                      <tr><td colSpan={11} className="table-cell text-center text-gray-400 py-12">No active employees</td></tr>
                    ) : monthlySummary.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{row.employeeName}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(row.monthlySalary)}/mo</p>
                        </td>
                        <td className="table-cell"><span className="badge-info">{row.designation}</span></td>
                        <td className="table-cell text-center text-green-600 font-semibold">{row.P}</td>
                        <td className="table-cell text-center text-red-500 font-semibold">{row.A}</td>
                        <td className="table-cell text-center text-blue-500 font-semibold">{row.L}</td>
                        <td className="table-cell text-center text-orange-500 font-semibold">{row.HDF}</td>
                        <td className="table-cell text-center text-amber-500 font-semibold">{row.HDS}</td>
                        <td className="table-cell text-center text-purple-500 font-semibold">{row.LP}</td>
                        <td className="table-cell text-center text-gray-400 font-semibold">{row.H}</td>
                        <td className="table-cell text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${row.attendancePct >= 80 ? 'bg-green-500' : row.attendancePct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${row.attendancePct}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{row.attendancePct}%</span>
                          </div>
                        </td>
                        <td className="table-cell text-right">
                          <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(row.salaryEarned)}</span>
                          <p className="text-xs text-gray-400">₹{row.perDaySalary}/day</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {monthlySummary.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={10} className="table-cell font-semibold text-gray-700 dark:text-gray-300 text-right pr-4">
                          Total Salary ({MONTHS[summaryMonth - 1]} {summaryYear}):
                        </td>
                        <td className="table-cell text-right font-bold text-base sm:text-lg text-gray-900 dark:text-white">
                          {formatCurrency(monthlySummary.reduce((s, r) => s + r.salaryEarned, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
