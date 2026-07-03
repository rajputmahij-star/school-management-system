import React, { useState } from 'react'
import {
  HiDocumentDownload, HiAcademicCap, HiUsers,
  HiCurrencyRupee, HiClipboardList,
} from 'react-icons/hi'
import {
  getStudents, getEmployees, getPayments,
  getCollection, where,
} from '../../firebase/firestore'
import {
  generateStudentReport, generateEmployeeReport,
  generateFeeCollectionReport, generateSalaryReport,
} from '../../utils/pdfExport'
import {
  exportStudentsToExcel, exportEmployeesToExcel,
  exportPaymentsToExcel, exportSalaryToExcel,
} from '../../utils/excelExport'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Report card component — defined at module scope ──────────────────────────
const ReportCard = ({ title, icon: Icon, color, onPDF, onExcel, loadPDF, loadExcel }) => (
  <div className="card p-4 sm:p-5">
    <div className="flex items-start gap-4 mb-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">Download in your preferred format</p>
      </div>
    </div>
    <div className="flex gap-2">
      {onPDF && (
        <button onClick={onPDF} disabled={loadPDF}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {loadPDF ? <LoadingSpinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
          PDF
        </button>
      )}
      {onExcel && (
        <button onClick={onExcel} disabled={loadExcel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {loadExcel ? <LoadingSpinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
          Excel
        </button>
      )}
    </div>
  </div>
)

export default function Reports() {
  const [loading, setLoading] = useState({})
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())

  const setLoad = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }))

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleStudentPDF = async () => {
    setLoad('studentPDF', true)
    try { generateStudentReport(await getStudents()) }
    catch { toast.error('Failed to generate report') }
    setLoad('studentPDF', false)
  }

  const handleStudentExcel = async () => {
    setLoad('studentExcel', true)
    try { exportStudentsToExcel(await getStudents()) }
    catch { toast.error('Failed to export') }
    setLoad('studentExcel', false)
  }

  const handleActiveStudentPDF = async () => {
    setLoad('activeStudentPDF', true)
    try {
      const data = (await getStudents()).filter((s) => !s.leaveDate)
      generateStudentReport(data)
    } catch { toast.error('Failed to generate report') }
    setLoad('activeStudentPDF', false)
  }

  const handleEmployeePDF = async () => {
    setLoad('empPDF', true)
    try { generateEmployeeReport(await getEmployees()) }
    catch { toast.error('Failed to generate') }
    setLoad('empPDF', false)
  }

  const handleEmployeeExcel = async () => {
    setLoad('empExcel', true)
    try { exportEmployeesToExcel(await getEmployees()) }
    catch { toast.error('Failed to export') }
    setLoad('empExcel', false)
  }

  const handlePaymentPDF = async () => {
    setLoad('paymentPDF', true)
    try { generateFeeCollectionReport(await getPayments(), month, year) }
    catch { toast.error('Failed to generate') }
    setLoad('paymentPDF', false)
  }

  const handlePaymentExcel = async () => {
    setLoad('paymentExcel', true)
    try { exportPaymentsToExcel(await getPayments()) }
    catch { toast.error('Failed to export') }
    setLoad('paymentExcel', false)
  }

  const handleSalaryPDF = async () => {
    setLoad('salaryPDF', true)
    try {
      const data = await getCollection('salaries', [
        where('month', '==', month),
        where('year',  '==', year),
      ])
      if (data.length === 0) { toast.error('No salary data for selected month'); return }
      generateSalaryReport(data, month, year)
    } catch (err) { toast.error('Failed to generate: ' + err.message) }
    setLoad('salaryPDF', false)
  }

  const handleSalaryExcel = async () => {
    setLoad('salaryExcel', true)
    try {
      const data = await getCollection('salaries', [
        where('month', '==', month),
        where('year',  '==', year),
      ])
      exportSalaryToExcel(data)
    } catch { toast.error('Failed to export') }
    setLoad('salaryExcel', false)
  }

  const years = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate and download school reports</p>
      </div>

      {/* Period selector */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Select Period (for salary & fee reports)
        </p>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input-field w-36">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input-field w-28">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard
          title="All Students Report"
          icon={HiAcademicCap} color="bg-blue-500"
          onPDF={handleStudentPDF}    loadPDF={loading.studentPDF}
          onExcel={handleStudentExcel} loadExcel={loading.studentExcel}
        />
        <ReportCard
          title="Active Students Report"
          icon={HiAcademicCap} color="bg-green-500"
          onPDF={handleActiveStudentPDF} loadPDF={loading.activeStudentPDF}
        />
        <ReportCard
          title="Employee Report"
          icon={HiUsers} color="bg-purple-500"
          onPDF={handleEmployeePDF}    loadPDF={loading.empPDF}
          onExcel={handleEmployeeExcel} loadExcel={loading.empExcel}
        />
        <ReportCard
          title="Fee Collection Report"
          icon={HiCurrencyRupee} color="bg-yellow-500"
          onPDF={handlePaymentPDF}    loadPDF={loading.paymentPDF}
          onExcel={handlePaymentExcel} loadExcel={loading.paymentExcel}
        />
        <ReportCard
          title="Salary Report"
          icon={HiClipboardList} color="bg-indigo-500"
          onPDF={handleSalaryPDF}    loadPDF={loading.salaryPDF}
          onExcel={handleSalaryExcel} loadExcel={loading.salaryExcel}
        />
      </div>
    </div>
  )
}
