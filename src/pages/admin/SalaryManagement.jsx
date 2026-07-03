import React, { useState, useEffect, useMemo } from 'react'
import {
  HiCalculator, HiDownload, HiEye, HiPrinter,
  HiCash, HiCalendar, HiX, HiDocumentText,
} from 'react-icons/hi'
import {
  getEmployees, getEmployeeAttendance, saveSalary,
  getCollection, updateDocument, where,
} from '../../firebase/firestore'
import { formatCurrency, computeNetSalary, getMonthDays, formatDate } from '../../utils/helpers'
import { downloadSalarySlip, viewSalarySlip, printSalarySlip } from '../../utils/salarySlip'
import { exportSalaryToExcel } from '../../utils/excelExport'
import { generateSalaryReport, generateSalaryReceipt } from '../../utils/pdfExport'
import { generateReceiptNumber } from '../../utils/receiptGenerator'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

export default function SalaryManagement() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear())
  const [employees,  setEmployees]  = useState([])
  const [salaryMap,  setSalaryMap]  = useState({})   // { employeeId: salaryDoc }
  const [loading,    setLoading]    = useState(true)
  const [processing, setProcessing] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)

  // Mark Paid dialog
  const [paidDialog, setPaidDialog] = useState({ open: false, salary: null, emp: null })
  const [refId,    setRefId]    = useState('')
  const [payDate,  setPayDate]  = useState(format(now, 'yyyy-MM-dd'))
  const [marking,  setMarking]  = useState(false)

  useEffect(() => { loadData() }, [selectedMonth, selectedYear])

  const loadData = async () => {
    try {
      setLoading(true)
      const emps = await getEmployees()
      const activeEmps = emps.filter((e) => !e.leaveDate)
      setEmployees(activeEmps)

      const existing = await getCollection('salaries', [
        where('month', '==', selectedMonth),
        where('year',  '==', selectedYear),
      ])
      const map = {}
      existing.forEach((s) => { map[s.employeeId] = s })
      setSalaryMap(map)
    } catch (err) {
      toast.error(`Failed to load: ${err.message}`)
    } finally { setLoading(false) }
  }

  // Real calendar days for selected month
  const monthDays = useMemo(() => getMonthDays(selectedMonth, selectedYear), [selectedMonth, selectedYear])

  const calculateAll = async () => {
    setProcessing(true)
    try {
      for (const emp of employees) {
        const uid = emp.uid || emp.id
        const records = await getEmployeeAttendance(uid, selectedMonth, selectedYear)

        const presentDays = records.filter((a) => a.attendanceType === 'Present').length
        const halfDays    = records.filter((a) => a.attendanceType === 'Half Day').length
        const absentDays  = records.filter((a) => a.attendanceType === 'Absent').length
        const leaveDays   = records.filter((a) => a.attendanceType === 'Leave').length

        // Half days count as 0.5 present
        const effectivePresent = presentDays + halfDays * 0.5
        const { salaryEarned, deduction, salaryAfterDeduction, smcTax, netSalary } =
          computeNetSalary(emp.monthlySalary, effectivePresent, selectedMonth, selectedYear)

        await saveSalary({
          employeeId:          uid,
          employeeName:        emp.employeeName,
          designation:         emp.designation,
          monthlySalary:       emp.monthlySalary,
          month:               selectedMonth,
          year:                selectedYear,
          monthDays,
          presentDays:         effectivePresent,
          rawPresentDays:      presentDays,
          halfDays,
          absentDays,
          leaveDays,
          salaryEarned,
          deduction,
          salaryAfterDeduction,
          smcTax,
          netSalary,
          status:              'Pending',
        })
      }
      toast.success(`Salary calculated for ${employees.length} employees`)
      loadData()
    } catch (err) {
      toast.error(`Calculation failed: ${err.message}`)
      console.error(err)
    } finally { setProcessing(false) }
  }

  const openMarkPaid = (emp) => {
    const s = salaryMap[emp.uid || emp.id]
    if (!s) { toast.error('Calculate salary first'); return }
    if (s.status === 'Paid') { toast('Already marked as paid'); return }
    setPaidDialog({ open: true, salary: s, emp })
    setRefId('')
    setPayDate(format(now, 'yyyy-MM-dd'))
  }

  const handleMarkPaid = async () => {
    if (!refId.trim()) { toast.error('Reference ID is required'); return }
    setMarking(true)
    try {
      // Generate receipt number for this salary payment
      const receiptNumber = await generateReceiptNumber('salary')

      await updateDocument('salaries', paidDialog.salary.id, {
        status:      'Paid',
        referenceId: refId.trim(),
        payDate:     Timestamp.fromDate(new Date(payDate)),
        receiptNumber, // Store receipt number
      })
      toast.success(`Salary marked as Paid! Receipt: ${receiptNumber}`)
      setPaidDialog({ open: false, salary: null, emp: null })
      loadData()
    } catch (err) {
      toast.error(err.message)
    } finally { setMarking(false) }
  }

  const handleViewSlip = (emp) => {
    const s = salaryMap[emp.uid || emp.id]
    if (!s) { toast.error('Calculate salary first'); return }
    viewSalarySlip(s, emp)
  }

  const handleDownloadSlip = (emp) => {
    const s = salaryMap[emp.uid || emp.id]
    if (!s) { toast.error('Calculate salary first'); return }
    downloadSalarySlip(s, emp)
  }

  const handleExport = () => {
    const data = employees.map((emp) => {
      const s = salaryMap[emp.uid || emp.id]
      return {
        employeeName:  emp.employeeName,
        designation:   emp.designation,
        month:         MONTHS[selectedMonth - 1],
        year:          selectedYear,
        monthlySalary: emp.monthlySalary,
        monthDays,
        presentDays:   s?.presentDays   || 0,
        salaryEarned:  s?.salaryEarned  || 0,
        deduction:     s?.deduction     || 0,
        smcTax:        s?.smcTax        || 0,
        netSalary:     s?.netSalary     || 0,
        status:        s?.status        || 'Not Calculated',
        payDate:       s?.payDate ? formatDate(s.payDate) : '',
        referenceId:   s?.referenceId   || '',
      }
    })
    exportSalaryToExcel(data)
  }

  const handlePdfExport = async () => {
    setPdfExporting(true)
    try {
      const salaries = employees.map((emp) => {
        const s = salaryMap[emp.uid || emp.id]
        return {
          employeeId:    emp.employeeId || emp.id,
          employeeName:  emp.employeeName,
          designation:   emp.designation,
          monthlySalary: emp.monthlySalary,
          monthDays,
          presentDays:   s?.presentDays   ?? null,
          netSalary:     s?.netSalary     ?? null,
          status:        s?.status        || 'Not Calculated',
          payDate:       s?.payDate       || null,
          referenceId:   s?.referenceId   || '',
        }
      })
      await generateSalaryReport(salaries, selectedMonth, selectedYear)
    } catch (err) {
      toast.error(`PDF export failed: ${err.message}`)
    } finally { setPdfExporting(false) }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary Management</h1>
          <p className="text-sm text-gray-500">
            {MONTHS[selectedMonth - 1]} {selectedYear} — {monthDays} calendar days
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="btn-secondary text-sm">
            <HiDownload className="w-4 h-4" /> Export
          </button>
          <button onClick={handlePdfExport} disabled={pdfExporting || loading} className="btn-secondary text-sm">
            {pdfExporting ? <LoadingSpinner size="sm" /> : <HiDocumentText className="w-4 h-4 text-red-500" />}
            PDF Report
          </button>
          <button onClick={calculateAll} disabled={processing || loading} className="btn-primary text-sm">
            {processing ? <><LoadingSpinner size="sm" /> Calculating…</> : <><HiCalculator className="w-4 h-4" /> Calculate All</>}
          </button>
        </div>
      </div>

      {/* Month / Year selector */}
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Month</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="input-field w-40">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="input-field w-28">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Month Days (auto)</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{monthDays}</p>
          <p className="text-xs text-blue-500">{MONTHS[selectedMonth - 1]} {selectedYear}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="table-header">Employee</th>
                  <th className="table-header hidden sm:table-cell">Designation</th>
                  <th className="table-header">Salary</th>
                  <th className="table-header hidden md:table-cell">Present</th>
                  <th className="table-header hidden md:table-cell">Days</th>
                  <th className="table-header">Net Salary</th>
                  <th className="table-header">Status</th>
                  <th className="table-header hidden lg:table-cell">Pay Date</th>
                  <th className="table-header hidden lg:table-cell">Reference</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {employees.length === 0 ? (
                  <tr><td colSpan={10} className="table-cell text-center text-gray-400 py-12">No active employees</td></tr>
                ) : employees.map((emp) => {
                  const s   = salaryMap[emp.uid || emp.id]
                  const net = s?.netSalary ?? null

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                            {emp.photo ? <img src={emp.photo} alt="" className="w-full h-full object-cover rounded-full" /> : emp.employeeName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{emp.employeeName}</p>
                            <p className="text-xs text-gray-400 sm:hidden">{emp.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell hidden sm:table-cell"><span className="badge-info">{emp.designation}</span></td>
                      <td className="table-cell font-medium">{formatCurrency(emp.monthlySalary)}</td>
                      <td className="table-cell text-center hidden md:table-cell">
                        <span className="text-green-600 font-semibold">{s?.presentDays != null ? s.presentDays : '—'}</span>
                      </td>
                      <td className="table-cell text-center hidden md:table-cell text-gray-500">{s ? s.monthDays : monthDays}</td>
                      <td className="table-cell">
                        {net != null ? (
                          <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(net)}</span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="table-cell">
                        {s?.status === 'Paid'
                          ? <span className="badge-success">Paid</span>
                          : s?.status === 'Pending'
                            ? <span className="badge-warning">Pending</span>
                            : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>
                      <td className="table-cell hidden lg:table-cell text-sm text-gray-500">
                        {s?.payDate ? formatDate(s.payDate) : '—'}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs font-mono text-gray-600 dark:text-gray-400">
                        {s?.referenceId || '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button onClick={() => handleViewSlip(emp)} title="View Slip"
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                            <HiEye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleDownloadSlip(emp)} title="Download Slip"
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                            <HiDownload className="w-4 h-4 text-blue-500" />
                          </button>
                          {s && s.status === 'Paid' && (
                            <button 
                              onClick={() => generateSalaryReceipt(s, emp)} 
                              title="Download Receipt"
                              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                              <HiDocumentText className="w-4 h-4 text-green-500" />
                            </button>
                          )}
                          {s && s.status !== 'Paid' && (
                            <button onClick={() => openMarkPaid(emp)} title="Mark Paid"
                              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded-lg whitespace-nowrap">
                              <HiCash className="w-3 h-3" /> Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark Paid Dialog */}
      <Modal isOpen={paidDialog.open} onClose={() => !marking && setPaidDialog({ open: false, salary: null, emp: null })}
        title="Mark Salary as Paid" size="sm">
        {paidDialog.emp && paidDialog.salary && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="font-semibold text-gray-900 dark:text-white">{paidDialog.emp.employeeName}</p>
              <p className="text-xs text-gray-500">{paidDialog.emp.designation}</p>
              <p className="text-sm font-bold text-green-600 mt-1">
                Net: {formatCurrency(paidDialog.salary.netSalary)}
              </p>
            </div>
            <div>
              <label className="label">Reference ID <span className="text-red-500">*</span></label>
              <input type="text" value={refId} onChange={(e) => setRefId(e.target.value)}
                className="input-field" placeholder="e.g. TXN123456 / CHQ001" required />
            </div>
            <div>
              <label className="label">Payment Date <span className="text-red-500">*</span></label>
              <div className="relative">
                <HiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className="input-field pl-9" required />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPaidDialog({ open: false, salary: null, emp: null })}
                className="btn-secondary" disabled={marking}>Cancel</button>
              <button onClick={handleMarkPaid} disabled={marking} className="btn-primary">
                {marking ? <><LoadingSpinner size="sm" /> Saving…</> : <><HiCash className="w-4 h-4" /> Confirm Paid</>}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
