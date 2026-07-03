import React, { useState, useEffect, useMemo } from 'react'
import { HiCheckCircle, HiClock, HiExclamation, HiExternalLink, HiPaperAirplane, HiX } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { getFeeRules, getFeeSettings, getSettings, getFeeLedger, addPaymentRequest, getPaymentRequests } from '../../firebase/firestore'
import { formatDate, formatCurrency, calculateStudentFee, getFeeStartDate, isNiosGroup } from '../../utils/helpers'
import { generatePeriods, mergeLedger, QUARTER_MONTHS, getQuarterIndex } from '../../utils/feeEngine'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, daysLate }) => {
  if (status === 'Paid')
    return <span className="badge-success flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" />Paid</span>
  if (status === 'Advance Paid')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"><HiCheckCircle className="w-3.5 h-3.5" />Advance Paid</span>
  if (status === 'Verification Pending')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><HiClock className="w-3.5 h-3.5" />Pending Verification</span>
  if (status === 'Rejected')
    return <span className="badge-danger flex items-center gap-1"><HiX className="w-3.5 h-3.5" />Rejected</span>
  if (daysLate > 0)
    return <span className="badge-danger flex items-center gap-1"><HiExclamation className="w-3.5 h-3.5" />Late ({daysLate}d)</span>
  return <span className="badge-warning flex items-center gap-1"><HiClock className="w-3.5 h-3.5" />Pending</span>
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const isPaidStatus = (s) => s === 'Paid' || s === 'Advance Paid' || s === 'Verification Pending'

// Group allRows by year for the year dropdown
function getYearsFromRows(rows) {
  const years = new Set()
  rows.forEach((r) => {
    const [y] = r.periodKey.split('-')
    years.add(Number(y))
  })
  return [...years].sort()
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
// allRows = ALL periods (paid + unpaid), so we can show status per month
const PaymentModal = ({ allRows, baseFeePerMonth, userData, paymentWebsiteUrl, onClose, onSubmitted }) => {
  const now = new Date()
  const years = getYearsFromRows(allRows)
  const defaultYear = years[years.length - 1] || now.getFullYear()

  const [mode,         setMode]         = useState('Monthly')   // Monthly | Quarterly | Yearly
  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [selectedKey,  setSelectedKey]  = useState('')          // starting periodKey
  const [form,         setForm]         = useState({ referenceId: '', paymentDate: '', remarks: '' })
  const [saving,       setSaving]       = useState(false)
  const h = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  // Map all rows by periodKey for fast lookup
  const rowMap = useMemo(() => {
    const m = {}
    allRows.forEach((r) => { m[r.periodKey] = r })
    return m
  }, [allRows])

  // Monthly: show all months of selectedYear with paid/pending status
  const monthlyOptions = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const key = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`
      const row = rowMap[key]
      const paid = row ? isPaidStatus(row.status) : false
      return { key, name, paid, row }
    }).filter((o) => o.row) // only show months that exist in the student's periods
  }, [selectedYear, rowMap])

  // Quarterly: starting from selectedKey, pick next 3 unpaid months (skipping paid ones)
  const quarterlyResult = useMemo(() => {
    if (!selectedKey) return []
    const startIdx = allRows.findIndex((r) => r.periodKey === selectedKey)
    if (startIdx === -1) return []
    const result = []
    for (let i = startIdx; i < allRows.length && result.length < 3; i++) {
      const r = allRows[i]
      if (!isPaidStatus(r.status)) result.push(r)
    }
    return result
  }, [selectedKey, allRows])

  // Yearly: starting from selectedKey, pick next 11 unpaid months for the academic year
  // Academic year runs from June (selected year) to May (next year)
  const yearlyResult = useMemo(() => {
    if (!selectedKey) return []
    
    // Extract year and month from selectedKey
    const [yearStr, monthStr] = selectedKey.split('-')
    const selectedYearNum = parseInt(yearStr)
    const selectedMonthNum = parseInt(monthStr)
    
    // Determine academic year start
    // If selected month is June-December, academic year is June of selected year
    // If selected month is January-May, academic year started in previous June
    const academicYearStart = selectedMonthNum >= 6 ? selectedYearNum : selectedYearNum - 1
    
    // Build 12-month academic year cycle: June to May
    const academicYearMonths = []
    for (let i = 0; i < 12; i++) {
      const month = 6 + i  // Start from June (month 6)
      const year = month > 12 ? academicYearStart + 1 : academicYearStart
      const adjustedMonth = month > 12 ? month - 12 : month
      const key = `${year}-${String(adjustedMonth).padStart(2, '0')}`
      academicYearMonths.push(key)
    }
    
    // Find unpaid months in this academic year cycle
    const result = []
    for (const key of academicYearMonths) {
      const row = allRows.find(r => r.periodKey === key)
      if (row && !isPaidStatus(row.status)) {
        result.push(row)
      }
    }
    
    // Return 11 months maximum (1 month free in academic year)
    return result.slice(0, 11)
  }, [selectedKey, allRows])

  // All unpaid rows for quarterly/yearly starting month dropdown
  const unpaidRows = useMemo(() => allRows.filter((r) => !isPaidStatus(r.status)), [allRows])

  // Compute what will be submitted based on mode
  const rowsToSubmit = useMemo(() => {
    if (mode === 'Monthly') {
      if (!selectedKey) return []
      const row = rowMap[selectedKey]
      return row && !isPaidStatus(row.status) ? [row] : []
    }
    if (mode === 'Quarterly') return quarterlyResult
    if (mode === 'Yearly')    return yearlyResult
    return []
  }, [mode, selectedKey, rowMap, quarterlyResult, yearlyResult])

  const totalBase    = rowsToSubmit.reduce((s, r) => s + (r.baseFee || baseFeePerMonth), 0)
  const totalFine    = rowsToSubmit.reduce((s, r) => s + (r.fine || 0), 0)
  const totalPayable = totalBase + totalFine

  // Reset selectedKey when mode changes
  const handleModeChange = (m) => { setMode(m); setSelectedKey('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rowsToSubmit.length === 0)    { toast.error('Select a valid starting month'); return }
    if (!form.referenceId.trim())     { toast.error('Reference ID is required'); return }
    if (!form.paymentDate)            { toast.error('Payment date is required'); return }
    setSaving(true)
    try {
      await Promise.all(rowsToSubmit.map((row) =>
        addPaymentRequest({
          studentId:     userData.uid || userData.id,
          studentName:   userData.studentName,
          className:     userData.className,
          periodKey:     row.periodKey,
          billingPeriod: row.label,
          paymentType:   mode,
          baseAmount:    row.baseFee || baseFeePerMonth,
          lateFee:       row.fine || 0,
          totalAmount:   (row.baseFee || baseFeePerMonth) + (row.fine || 0),
          referenceId:   form.referenceId.trim(),
          paymentDate:   form.paymentDate,
          remarks:       form.remarks.trim(),
          status:        'Verification Pending',
          submittedAt:   Timestamp.fromDate(new Date()),
          verifiedBy:    null, verifiedAt: null, rejectionReason: null,
        })
      ))
      toast.success(`Payment submitted for ${rowsToSubmit.length} month(s)!`)
      onSubmitted()
    } catch (err) { toast.error(err.message || 'Submission failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white">Pay Fee</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <HiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode tabs */}
          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-2">
              {['Monthly','Quarterly','Yearly'].map((m) => (
                <button key={m} type="button" onClick={() => handleModeChange(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                    mode === m
                      ? 'border-transparent text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                  style={mode === m ? { backgroundColor: '#E86E07' } : {}}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* ── MONTHLY ── */}
          {mode === 'Monthly' && (
            <div className="space-y-3">
              {/* Year selector */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Year</label>
                  <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedKey('') }}
                    className="input-field">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {/* Month list */}
              <div>
                <label className="label">Select Month</label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {monthlyOptions.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-4">No months for {selectedYear}</p>
                    : monthlyOptions.map(({ key, name, paid, row }) => (
                      <button key={key} type="button" disabled={paid}
                        onClick={() => setSelectedKey(selectedKey === key ? '' : key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-colors text-left ${
                          paid
                            ? 'border-green-200 bg-green-50 dark:bg-green-900/10 cursor-not-allowed'
                            : selectedKey === key
                              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          {paid
                            ? <span className="text-green-500 text-base leading-none">✅</span>
                            : <span className="text-red-400 text-base leading-none">🔴</span>}
                          <span className={`text-sm font-medium ${paid ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                            {name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {paid
                            ? <span className="text-xs font-semibold text-green-600 dark:text-green-400">Paid</span>
                            : <span className="text-xs text-gray-500">{formatCurrency(row?.baseFee || baseFeePerMonth)}</span>}
                          {!paid && selectedKey === key && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                        </div>
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── QUARTERLY ── */}
          {mode === 'Quarterly' && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Year</label>
                  <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedKey('') }}
                    className="input-field">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Starting Month</label>
                <p className="text-xs text-gray-400 mb-2">System picks the next 3 unpaid months from here, skipping already paid ones.</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {MONTH_NAMES.map((name, idx) => {
                    const key = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`
                    const row = rowMap[key]
                    if (!row) return null
                    const paid = isPaidStatus(row.status)
                    return (
                      <button key={key} type="button" disabled={paid}
                        onClick={() => setSelectedKey(selectedKey === key ? '' : key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-colors text-left ${
                          paid
                            ? 'border-green-200 bg-green-50 dark:bg-green-900/10 cursor-not-allowed'
                            : selectedKey === key
                              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">{paid ? '✅' : '🔴'}</span>
                          <span className={`text-sm font-medium ${paid ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                            {name}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{paid ? 'Paid' : formatCurrency(row.baseFee || baseFeePerMonth)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Preview of 3 months */}
              {quarterlyResult.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2">
                    Will pay {quarterlyResult.length} month(s):
                  </p>
                  <div className="space-y-1">
                    {quarterlyResult.map((r) => (
                      <div key={r.periodKey} className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                        <span>{r.label}</span>
                        <span>{formatCurrency((r.baseFee || baseFeePerMonth) + (r.fine || 0))}</span>
                      </div>
                    ))}
                  </div>
                  {quarterlyResult.length < 3 && (
                    <p className="text-xs text-orange-500 mt-2">Only {quarterlyResult.length} unpaid month(s) remaining.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── YEARLY ── */}
          {mode === 'Yearly' && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Year</label>
                  <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedKey('') }}
                    className="input-field">
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Starting Month</label>
                <p className="text-xs text-gray-400 mb-2">Select any month - system will cover the full academic year (June to May) with 11 months payment (1 month free).</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {MONTH_NAMES.map((name, idx) => {
                    const key = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`
                    const row = rowMap[key]
                    if (!row) return null
                    const paid = isPaidStatus(row.status)
                    return (
                      <button key={key} type="button" disabled={paid}
                        onClick={() => setSelectedKey(selectedKey === key ? '' : key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-colors text-left ${
                          paid
                            ? 'border-green-200 bg-green-50 dark:bg-green-900/10 cursor-not-allowed'
                            : selectedKey === key
                              ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-none">{paid ? '✅' : '🔴'}</span>
                          <span className={`text-sm font-medium ${paid ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                            {name}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{paid ? 'Paid' : formatCurrency(row.baseFee || baseFeePerMonth)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {yearlyResult.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2">
                    Academic Year Payment — {yearlyResult.length} month(s) ({12 - yearlyResult.length} month{12 - yearlyResult.length !== 1 ? 's' : ''} free):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {yearlyResult.map((r) => (
                      <div key={r.periodKey} className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                        <span>{r.label}</span>
                        <span>{formatCurrency((r.baseFee || baseFeePerMonth) + (r.fine || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fee summary */}
          {rowsToSubmit.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{rowsToSubmit.length} month{rowsToSubmit.length > 1 ? 's' : ''}</span>
                <span>{formatCurrency(totalBase)}</span>
              </div>
              {totalFine > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Late Fees</span><span>{formatCurrency(totalFine)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1">
                <span>Total to Pay</span>
                <span style={{ color: '#E86E07' }}>{formatCurrency(totalPayable)}</span>
              </div>
            </div>
          )}

          {paymentWebsiteUrl && (
            <a href={paymentWebsiteUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: '#E86E07' }}>
              <HiExternalLink className="w-4 h-4" /> Open School Payment Website
            </a>
          )}

          <div>
            <label className="label">Reference / Transaction ID <span className="text-red-500">*</span></label>
            <input type="text" value={form.referenceId} onChange={h('referenceId')} className="input-field" placeholder="e.g. TXN123456" required />
          </div>
          <div>
            <label className="label">Payment Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.paymentDate} onChange={h('paymentDate')} className="input-field" required />
          </div>
          <div>
            <label className="label">Remarks <span className="text-xs text-gray-400">(optional)</span></label>
            <textarea value={form.remarks} onChange={h('remarks')} className="input-field resize-none" rows={2} placeholder="Any notes" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving || rowsToSubmit.length === 0} className="btn-primary flex-1 justify-center">
              {saving ? <><LoadingSpinner size="sm" /> Submitting…</> : <><HiPaperAirplane className="w-4 h-4" /> Submit</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentFees() {
  const { userData } = useAuth()
  const [feeRules,    setFeeRules]    = useState([])
  const [feeSettings, setFeeSettings] = useState(null)
  const [settings,    setSettings]    = useState(null)
  const [ledger,      setLedger]      = useState([])
  const [requests,    setRequests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)

  const uid = userData?.uid || userData?.id

  useEffect(() => { if (uid) load() }, [uid])

  const load = async () => {
    setLoading(true)
    try {
      const [rules, fs, s, led, reqs] = await Promise.all([
        getFeeRules(), getFeeSettings(), getSettings(),
        getFeeLedger(uid), getPaymentRequests(uid),
      ])
      setFeeRules(rules); setFeeSettings(fs); setSettings(s)
      setLedger(led); setRequests(reqs)
    } catch (err) { toast.error('Failed to load fee data') }
    finally { setLoading(false) }
  }

  // baseFee per month for this student
  // NIOS Group students use their custom niosFee — standard fee rules do not apply
  const baseFeePerMonth = useMemo(() => {
    if (!userData) return 0
    if (isNiosGroup(userData.className)) {
      return Number(userData.niosFee) || 0
    }
    if (!feeRules.length) return 0
    return calculateStudentFee(feeRules, userData).fee || 0
  }, [userData, feeRules])

  // All monthly periods with smart filtering:
  // - Always generate from admission up to current month (history + dues)
  // - Only extend into FUTURE months if the current month is already paid (allow advance)
  // - "Due" count only includes months ≤ today that are unpaid
  const allRows = useMemo(() => {
    if (!userData || !baseFeePerMonth || !getFeeStartDate(userData)) return []
    const effectiveSettings = feeSettings || { defaultMonthlyDueDay: 5, defaultQuarterlyDueDay: 10 }
    const lateFeeBase   = settings?.lateFeeBase   || 250
    const lateFeePerDay = settings?.lateFeePerDay || 25
    const dueDay = effectiveSettings.defaultMonthlyDueDay || 5

    const feeStartDate = getFeeStartDate(userData)
    const startRaw = feeStartDate?.toDate ? feeStartDate.toDate() : new Date(feeStartDate)

    // Build the ledger map first so we can check if current month is paid
    const ledgerMap = {}
    ledger.forEach((e) => { ledgerMap[e.periodKey] = e })
    requests.forEach((r) => {
      if (r.status === 'Verification Pending') {
        ledgerMap[r.periodKey] = { ...(ledgerMap[r.periodKey] || {}), status: 'Verification Pending' }
      }
    })

    // Check if current month is paid
    const now = new Date()
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const currentMonthPaid = isPaidStatus(ledgerMap[currentKey]?.status)

    // Always extend at least 11 months into the future so quarterly (3 months)
    // and yearly (11 months) payment modes always have enough periods to select.
    // If current month is paid, extend 12 months (advance payment).
    // If current month is unpaid, still extend 11 months for quarterly/yearly.
    const futureMonths = currentMonthPaid ? 12 : 11
    const endDate = new Date(now.getFullYear(), now.getMonth() + futureMonths, 1)

    const periods = []
    let cursor = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1)
    const startMonth = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1)

    while (cursor <= endDate) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth()
      const key = `${y}-${String(m + 1).padStart(2, '0')}`
      const dueDate = new Date(y, m, Math.min(dueDay, 28))
      const monthName = new Date(y, m, 1).toLocaleString('default', { month: 'long' })

      // Pro-rata for the first month if case history date is NOT the 1st of the month
      let periodFee = baseFeePerMonth
      const isFirstPeriod = cursor.getTime() === startMonth.getTime()
      if (isFirstPeriod && startRaw.getDate() > 1) {
        const totalDaysInMonth = new Date(y, m + 1, 0).getDate()
        const remainingDays = totalDaysInMonth - startRaw.getDate() + 1
        periodFee = Math.ceil((remainingDays / totalDaysInMonth) * baseFeePerMonth)
      }

      periods.push({ periodKey: key, label: `${monthName} ${y}`, dueDate, baseFee: periodFee, billingType: 'Monthly', isProRata: isFirstPeriod && startRaw.getDate() > 1 })
      cursor = new Date(y, m + 1, 1)
    }

    const caseHistoryDate = getFeeStartDate(userData) // Student's admission/enrollment date
    return mergeLedger(periods, ledgerMap, lateFeeBase, lateFeePerDay, caseHistoryDate).map((r) => ({
      ...r,
      status: (r.status === 'Paid' && r.dueDate && new Date(r.dueDate) > new Date())
        ? 'Advance Paid' : r.status,
    }))
  }, [userData, baseFeePerMonth, feeSettings, ledger, requests, settings])

  const now2            = new Date()
  const currentKey2     = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`
  // Dues = unpaid months that are <= current month (not future advance months)
  const dueRows         = allRows.filter((r) => !isPaidStatus(r.status) && r.periodKey <= currentKey2)
  const unpaidCount     = dueRows.length
  const totalDue        = dueRows.reduce((s, r) => s + (r.totalPayable || 0), 0)
  const totalPaid       = allRows.filter((r) => r.status === 'Paid' || r.status === 'Advance Paid').reduce((s, r) => s + (r.baseFee || 0), 0)
  const currentMonthPaid2 = isPaidStatus(allRows.find((r) => r.periodKey === currentKey2)?.status)
  // History table: only show months up to current month (past + current)
  // Future months are available in allRows for the payment modal (quarterly/yearly)
  const historyRows     = allRows.filter((r) => r.periodKey <= currentKey2)
  const paymentWebsiteUrl = settings?.paymentWebsiteUrl || ''

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Fees</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and submit fee payments</p>
        </div>
        {allRows.length > 0 && (
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            <HiPaperAirplane className="w-4 h-4" /> Pay Fees
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className={`text-xl font-bold ${unpaidCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {unpaidCount > 0 ? formatCurrency(totalDue) : '✓ Clear'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {unpaidCount > 0 ? `${unpaidCount} month${unpaidCount > 1 ? 's' : ''} due` : 'No dues'}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Paid</p>
        </div>
        <div className="card p-4 text-center col-span-2 sm:col-span-1">
          <p className={`text-xl font-bold ${currentMonthPaid2 ? 'text-green-600' : 'text-orange-500'}`}>
            {currentMonthPaid2 ? '✓ Paid' : 'Pending'}
          </p>
          <p className="text-sm text-gray-500 mt-1">This Month</p>
        </div>
      </div>

      {/* Due alert banner — only when there are actual dues */}
      {unpaidCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <HiExclamation className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              {unpaidCount} pending payment{unpaidCount > 1 ? 's' : ''} — {formatCurrency(totalDue)} due
            </p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
              Please clear pending dues to avoid late fees.
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="text-xs font-semibold text-red-700 dark:text-red-400 underline whitespace-nowrap">
            Pay Now
          </button>
        </div>
      )}

      {/* Fee history table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Fee History</h2>
          <span className="text-xs text-gray-400">{historyRows.length} months</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="table-header">Month</th>
                <th className="table-header">Tuition Fee</th>
                <th className="table-header hidden sm:table-cell">Late Fee (if any)</th>
                <th className="table-header">Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {historyRows.map((row) => (
                <tr key={row.periodKey} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="table-cell font-medium">
                    {row.label}
                    {row.isProRata && (
                      <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        Pro-rata
                      </span>
                    )}
                  </td>
                  <td className="table-cell">{formatCurrency(row.baseFee)}</td>
                  <td className="table-cell hidden sm:table-cell">
                    {row.fine > 0 ? <span className="text-red-500">{formatCurrency(row.fine)}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="table-cell font-semibold">{formatCurrency(row.totalPayable)}</td>
                  <td className="table-cell"><StatusBadge status={row.status} daysLate={row.daysLate} /></td>
                  <td className="table-cell">
                    {!isPaidStatus(row.status) && (
                      <button onClick={() => setShowModal(true)}
                        className="text-xs font-medium flex items-center gap-1"
                        style={{ color: '#E86E07' }}>
                        <HiPaperAirplane className="w-3.5 h-3.5" /> Pay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {historyRows.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-12">No fee records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <PaymentModal
          allRows={allRows}
          baseFeePerMonth={baseFeePerMonth}
          userData={userData}
          paymentWebsiteUrl={paymentWebsiteUrl}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
