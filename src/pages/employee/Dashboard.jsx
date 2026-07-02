import React, { useState, useEffect, useMemo } from 'react'
import {
  HiCheck, HiX, HiClock, HiCalendar,
  HiCurrencyRupee, HiTrendingUp, HiDownload, HiEye, HiPrinter,
} from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { getEmployeeAttendance, getCollection, where } from '../../firebase/firestore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import AttendanceCalendar from '../../components/ui/AttendanceCalendar'
import toast from 'react-hot-toast'
import {
  formatDate, formatCurrency, computeNetSalary, getMonthDays,
} from '../../utils/helpers'
import { downloadSalarySlip, viewSalarySlip, printSalarySlip } from '../../utils/salarySlip'
import { format, addMonths, subMonths } from 'date-fns'

const SummaryCard = ({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </div>
)

export default function EmployeeDashboard() {
  const { userData } = useAuth()
  const now = new Date()

  const [calendarMonth, setCalendarMonth] = useState(now)
  const [attendance,  setAttendance]  = useState([])
  const [salaryDoc,   setSalaryDoc]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  // Salary history selector — defaults to current month
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth() + 1)
  const [salaryYear,  setSalaryYear]  = useState(now.getFullYear())

  const month = calendarMonth.getMonth() + 1
  const year  = calendarMonth.getFullYear()

  useEffect(() => {
    const empId = userData?.uid || userData?.id
    if (empId) loadAll(empId)
    else setLoading(false)
  }, [userData, calendarMonth])

  // Reload salary when month/year selector changes
  useEffect(() => {
    const empId = userData?.uid || userData?.id
    if (!empId) return
    getCollection('salaries', [
      where('employeeId', '==', empId),
      where('month', '==', salaryMonth),
      where('year',  '==', salaryYear),
    ]).then((docs) => setSalaryDoc(docs[0] || null)).catch(() => {})
  }, [salaryMonth, salaryYear, userData])

  useEffect(() => {
    const empId = userData?.uid || userData?.id
    if (empId) loadAll(empId)
    else setLoading(false)
  }, [userData, calendarMonth])

  const loadAll = async (empId) => {
    try {
      setLoading(true)
      const [att, salaries] = await Promise.all([
        getEmployeeAttendance(empId, month, year),
        getCollection('salaries', [
          where('employeeId', '==', empId),
          where('month',      '==', salaryMonth),
          where('year',       '==', salaryYear),
        ]),
      ])
      setAttendance(att)
      setSalaryDoc(salaries[0] || null)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally { setLoading(false) }
  }

  const monthDays = useMemo(() => getMonthDays(now.getMonth() + 1, now.getFullYear()), [])

  const counts = useMemo(() => {
    const valid = attendance.filter((a) => {
      const d = a.date?.toDate ? a.date.toDate() : new Date(a.dateStr + 'T00:00:00')
      return d.getDay() !== 0
    })
    return {
      Present:    valid.filter((a) => a.attendanceType === 'Present').length,
      Absent:     valid.filter((a) => a.attendanceType === 'Absent').length,
      'Half Day': valid.filter((a) => a.attendanceType === 'Half Day').length,
      Leave:      valid.filter((a) => a.attendanceType === 'Leave').length,
      records:    valid,
    }
  }, [attendance])

  const liveSalary = useMemo(() => {
    const effective = counts.Present + counts['Half Day'] * 0.5
    return computeNetSalary(userData?.monthlySalary || 0, effective, salaryMonth, salaryYear)
  }, [userData, counts, salaryMonth, salaryYear])

  const attendancePct = monthDays > 0
    ? Math.round(((counts.Present + counts['Half Day'] * 0.5) / monthDays) * 100)
    : 0

  const todayRecord = attendance.find((a) => a.dateStr === format(now, 'yyyy-MM-dd'))

  const display = salaryDoc ?? {
    monthlySalary:        userData?.monthlySalary || 0,
    presentDays:          counts.Present + counts['Half Day'] * 0.5,
    monthDays,
    salaryEarned:         liveSalary.salaryEarned,
    deduction:            liveSalary.deduction,
    salaryAfterDeduction: liveSalary.salaryAfterDeduction,
    smcTax:               liveSalary.smcTax,
    netSalary:            liveSalary.netSalary,
    status:               'Estimated',
  }

  const statusStyle = (type) => ({
    Present:    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    Absent:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    'Half Day': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    Leave:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  }[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-500')

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const salaryYears = []
  for (let y = 2024; y <= now.getFullYear(); y++) salaryYears.push(y)

  const handleViewSlip   = () => { if (salaryDoc) viewSalarySlip(salaryDoc, userData);     else toast.error('Salary not calculated yet') }
  const handleDownload   = () => { if (salaryDoc) downloadSalarySlip(salaryDoc, userData); else toast.error('Salary not calculated yet') }
  const handlePrint      = () => { if (salaryDoc) printSalarySlip(salaryDoc, userData);    else toast.error('Salary not calculated yet') }

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome, {userData?.employeeName}
        </h1>
        <p className="text-sm text-gray-500">{format(now, 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Today status */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">Today's Attendance</p>
          {todayRecord
            ? <span className={`text-base font-semibold px-3 py-1 rounded-full ${statusStyle(todayRecord.attendanceType)}`}>{todayRecord.attendanceType}</span>
            : <span className="text-sm text-gray-400">Not marked yet</span>
          }
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          todayRecord?.attendanceType === 'Present' ? 'bg-green-100 dark:bg-green-900/30' :
          todayRecord?.attendanceType === 'Absent'  ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          {todayRecord?.attendanceType === 'Present' ? <HiCheck className="w-6 h-6 text-green-600" /> :
           todayRecord?.attendanceType === 'Absent'  ? <HiX className="w-6 h-6 text-red-500" /> :
                                                       <HiCalendar className="w-6 h-6 text-gray-400" />}
        </div>
      </div>

      {/* Attendance Calendar */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Attendance Calendar</h2>
        {loading
          ? <div className="flex justify-center p-8"><LoadingSpinner /></div>
          : <AttendanceCalendar
              records={attendance}
              month={calendarMonth}
              onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
            />
        }
      </div>

      {/* Salary Statement */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Salary Statement</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month/Year selectors */}
            <select value={salaryYear} onChange={(e) => setSalaryYear(Number(e.target.value))}
              className="input-field w-24 py-1.5 text-xs">
              {salaryYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={salaryMonth} onChange={(e) => setSalaryMonth(Number(e.target.value))}
              className="input-field w-32 py-1.5 text-xs">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            {salaryDoc && (
              <div className="flex gap-1">
                <button onClick={handleViewSlip}  title="View"     className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><HiEye      className="w-4 h-4 text-gray-500" /></button>
                <button onClick={handleDownload}  title="Download" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><HiDownload className="w-4 h-4 text-blue-500" /></button>
                <button onClick={handlePrint}     title="Print"    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><HiPrinter  className="w-4 h-4 text-gray-500" /></button>
              </div>
            )}
          </div>
        </div>

        {loading ? <div className="flex justify-center p-8"><LoadingSpinner /></div> : (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Income</p>
            </div>
            {[
              ['Monthly Salary',  formatCurrency(display.monthlySalary), false],
              ['Present Days',    `${display.presentDays} / ${display.monthDays} days`, false],
              ['Salary Earned',   formatCurrency(display.salaryEarned), true],
            ].map(([label, value, bold]) => (
              <div key={label} className={`flex justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 ${bold ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                <span className={`text-sm ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
                <span className={`text-sm ${bold ? 'font-bold text-primary-600' : 'font-medium text-gray-900 dark:text-white'}`}>{value}</span>
              </div>
            ))}

            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deductions</p>
            </div>
            {[
              ['5% Deduction',    formatCurrency(display.deduction), false],
              ['Professional SMC Tax', display.smcTax > 0 ? formatCurrency(display.smcTax) : 'Nil', false],              ['Total Deductions', formatCurrency((display.deduction || 0) + (display.smcTax || 0)), true],
            ].map(([label, value, bold]) => (
              <div key={label} className={`flex justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 ${bold ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                <span className={`text-sm ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
                <span className={`text-sm ${bold ? 'font-bold text-red-500' : 'font-medium text-gray-900 dark:text-white'}`}>{value}</span>
              </div>
            ))}

            <div className="flex justify-between items-center px-5 py-4 bg-green-600">
              <span className="font-bold text-white text-base">NET SALARY</span>
              <span className="font-bold text-white text-xl">{formatCurrency(display.netSalary)}</span>
            </div>

            <div className="px-5 py-4 grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/30">
              {[
                ['Status',       salaryDoc?.status || 'Not Calculated'],
                ['Reference ID', salaryDoc?.referenceId || '—'],
                ['Pay Date',     salaryDoc?.payDate ? formatDate(salaryDoc.payDate) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            {!salaryDoc && (
              <div className="px-5 py-3 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-700 dark:text-yellow-400">
                ⚠️ Salary not yet calculated by admin. Values are estimates based on current attendance.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
