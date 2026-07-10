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
const PaymentModal = ({ allRows, baseFeePerMonth, userData, paymentWebsiteUrl, upiSettings, onClose, onSubmitted }) => {
  const now = new Date()
  const years = getYearsFromRows(allRows)
  // Default to current year (2026), not the last year in the list
  const currentYear = now.getFullYear()
  const defaultYear = years.includes(currentYear) ? currentYear : years[0] || currentYear

  const [mode,         setMode]         = useState('Monthly')   // Monthly | Quarterly | Yearly
  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [selectedKey,  setSelectedKey]  = useState('')          // starting periodKey
  const [upiMethod,    setUpiMethod]    = useState('link')      // 'link' | 'qr' for UPI payment
  const [form,         setForm]         = useState({ 
    referenceId: '', 
    paymentDate: '', 
    remarks: '',
    paymentMode: 'UPI',  // Default payment mode
    customAmount: '',    // For partial payment
    isPartialPayment: false
  })
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

  // Yearly: starting from selectedKey, pick next 12 consecutive months
  // Calculate fee for 12 months, then subtract 1 month fee (pay for 11, get 12 coverage)
  const yearlyResult = useMemo(() => {
    if (!selectedKey) return []
    
    const [startYear, startMonth] = selectedKey.split('-').map(Number)
    const result = []
    
    // Generate 12 consecutive month keys starting from selected month
    for (let i = 0; i < 12; i++) {
      const monthOffset = startMonth - 1 + i  // startMonth is 1-based
      const year = startYear + Math.floor(monthOffset / 12)
      const month = (monthOffset % 12) + 1
      const periodKey = `${year}-${String(month).padStart(2, '0')}`
      
      // Find this period in allRows
      const row = allRows.find(r => r.periodKey === periodKey)
      if (row && !isPaidStatus(row.status)) {
        result.push(row)
      }
    }
    
    // Return all months found (user pays for these, gets 12 months coverage including 1 free)
    // The discount of 1 month fee will be calculated in the total
    return result
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
  
  // For yearly payment: subtract 1 month base fee (1 month free benefit)
  const yearlyDiscount = mode === 'Yearly' && rowsToSubmit.length >= 11 ? baseFeePerMonth : 0
  const totalPayable = totalBase + totalFine - yearlyDiscount
  
  // Partial payment handling
  const customAmount = parseFloat(form.customAmount) || 0
  const actualPayment = form.isPartialPayment && customAmount > 0 && customAmount < totalPayable 
    ? customAmount 
    : totalPayable
  const remainingAmount = totalPayable - actualPayment

  // Reset selectedKey when mode changes
  const handleModeChange = (m) => { setMode(m); setSelectedKey('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rowsToSubmit.length === 0)    { toast.error('Select a valid starting month'); return }
    if (!form.referenceId.trim())     { toast.error('Reference ID is required'); return }
    if (!form.paymentDate)            { toast.error('Payment date is required'); return }
    if (form.isPartialPayment && customAmount >= totalPayable) { 
      toast.error('Partial amount must be less than total'); return 
    }
    if (form.isPartialPayment && customAmount <= 0) { 
      toast.error('Enter a valid partial payment amount'); return 
    }
    setSaving(true)
    try {
      await Promise.all(rowsToSubmit.map((row, index) => {
        // For partial payment, only the first period gets the partial amount
        // The remaining amount will be carried forward
        const isFirstPeriod = index === 0
        const periodAmount = (row.baseFee || baseFeePerMonth) + (row.fine || 0)
        
        return addPaymentRequest({
          studentId:     userData.uid || userData.id,
          studentName:   userData.studentName,
          className:     userData.className,
          periodKey:     row.periodKey,
          billingPeriod: row.label,
          paymentType:   mode,
          paymentMode:   form.paymentMode,  // Store payment mode
          baseAmount:    row.baseFee || baseFeePerMonth,
          lateFee:       row.fine || 0,
          totalAmount:   periodAmount,
          paidAmount:    form.isPartialPayment && isFirstPeriod ? actualPayment : periodAmount,
          remainingAmount: form.isPartialPayment && isFirstPeriod ? remainingAmount : 0,
          isPartialPayment: form.isPartialPayment && isFirstPeriod,
          referenceId:   form.referenceId.trim(),
          paymentDate:   form.paymentDate,
          remarks:       form.remarks.trim(),
          status:        'Verification Pending',
          submittedAt:   Timestamp.fromDate(new Date()),
          verifiedBy:    null, verifiedAt: null, rejectionReason: null,
        })
      }))
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
                <p className="text-xs text-gray-400 mb-2">Select starting month - covers 12 consecutive months. Pay for 11 months, get 12 months coverage (1 month free).</p>
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
                    Yearly Payment — 12 Months Coverage ({yearlyResult.length} months listed, pay for 11, get 1 free):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {yearlyResult.map((r) => (
                      <div key={r.periodKey} className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                        <span>{r.label}</span>
                        <span>{formatCurrency((r.baseFee || baseFeePerMonth) + (r.fine || 0))}</span>
                      </div>
                    ))}
                  </div>
                  {yearlyDiscount > 0 && (
                    <div className="mt-2 pt-2 border-t border-orange-300 dark:border-orange-600">
                      <p className="text-xs text-green-700 dark:text-green-400 font-semibold">
                        💰 Yearly Discount: {formatCurrency(yearlyDiscount)} (1 Month Free)
                      </p>
                    </div>
                  )}
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
              {yearlyDiscount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Yearly Discount (1 Month Free)</span>
                  <span>- {formatCurrency(yearlyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1">
                <span>Total to Pay</span>
                <span style={{ color: '#E86E07' }}>{formatCurrency(totalPayable)}</span>
              </div>
              {form.isPartialPayment && actualPayment > 0 && (
                <>
                  <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                    <span>Paying Now</span>
                    <span>{formatCurrency(actualPayment)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600 dark:text-orange-400 font-medium">
                    <span>Remaining (carried to next month)</span>
                    <span>{formatCurrency(remainingAmount)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Payment Mode Selection */}
          {rowsToSubmit.length > 0 && (
            <div>
              <label className="label">Payment Mode <span className="text-red-500">*</span></label>
              <select 
                value={form.paymentMode} 
                onChange={h('paymentMode')} 
                className="input-field"
              >
                <option value="UPI">UPI</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
              </select>
            </div>
          )}

          {/* Partial Payment Option */}
          {rowsToSubmit.length > 0 && (
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="partialPayment"
                  checked={form.isPartialPayment}
                  onChange={(e) => setForm(p => ({ ...p, isPartialPayment: e.target.checked, customAmount: '' }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="partialPayment" className="font-semibold text-purple-900 dark:text-purple-100 text-sm cursor-pointer">
                  Pay Partial Amount (if cannot pay full amount)
                </label>
              </div>
              
              {form.isPartialPayment && (
                <div className="space-y-2">
                  <div>
                    <label className="label text-xs">Amount to Pay Now <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={form.customAmount}
                        onChange={h('customAmount')}
                        className="input-field pl-7"
                        placeholder={`Enter amount (max: ${totalPayable})`}
                        min="1"
                        max={totalPayable}
                        step="1"
                      />
                    </div>
                  </div>
                  
                  {customAmount > 0 && customAmount < totalPayable && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>Total Fee:</span>
                        <span className="font-semibold">{formatCurrency(totalPayable)}</span>
                      </div>
                      <div className="flex justify-between text-green-700 dark:text-green-300">
                        <span>Paying Now:</span>
                        <span className="font-semibold">{formatCurrency(actualPayment)}</span>
                      </div>
                      <div className="flex justify-between text-orange-700 dark:text-orange-300 pt-1 border-t border-purple-200 dark:border-purple-700">
                        <span>Remaining:</span>
                        <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-purple-100 dark:bg-purple-900/40 rounded-lg p-2 text-xs text-purple-800 dark:text-purple-200">
                    💡 <strong>Note:</strong> Remaining amount will be added to your next month's fee automatically.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* UPI Payment Section - Only show if UPI is selected AND not partial payment */}
          {rowsToSubmit.length > 0 && form.paymentMode === 'UPI' && !form.isPartialPayment && upiSettings?.upiId && (
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm">Pay via UPI</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Quick & Secure Payment</p>
                </div>
              </div>
              
              {/* UPI Method Selector: Link or QR Code */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setUpiMethod('link')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    upiMethod === 'link'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-blue-200 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Pay via Link
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setUpiMethod('qr')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    upiMethod === 'qr'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-blue-200 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Scan QR Code
                  </div>
                </button>
              </div>

              {/* UPI Link Payment */}
              {upiMethod === 'link' && (
                <div className="space-y-3">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">UPI ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white break-all">
                        {upiSettings.upiId}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(upiSettings.upiId)
                          toast.success('UPI ID copied!')
                        }}
                        className="flex-shrink-0 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Copy UPI ID"
                      >
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* UPI Payment URL - visible and copyable */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">UPI Payment Link</p>
                    <div className="flex items-start gap-2">
                      <code className="flex-1 text-xs font-mono text-blue-600 dark:text-blue-400 break-all bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                        {`upi://pay?pa=${encodeURIComponent(upiSettings.upiId)}&pn=${encodeURIComponent(upiSettings.upiPayeeName || 'School')}&am=${actualPayment}&cu=INR&tn=Fee%20Payment%20for%20${rowsToSubmit.length}%20month(s)`}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          const upiUrl = `upi://pay?pa=${encodeURIComponent(upiSettings.upiId)}&pn=${encodeURIComponent(upiSettings.upiPayeeName || 'School')}&am=${actualPayment}&cu=INR&tn=Fee%20Payment%20for%20${rowsToSubmit.length}%20month(s)`
                          navigator.clipboard.writeText(upiUrl)
                          toast.success('UPI payment link copied!')
                        }}
                        className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Copy UPI Link"
                      >
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Copy this link and paste in any UPI app to pay</p>
                  </div>

                  <a
                    href={`upi://pay?pa=${encodeURIComponent(upiSettings.upiId)}&pn=${encodeURIComponent(upiSettings.upiPayeeName || 'School')}&am=${actualPayment}&cu=INR&tn=Fee%20Payment%20for%20${rowsToSubmit.length}%20month(s)`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.87-.94-7-5.17-7-9V8.69l7-3.5 7 3.5V11c0 3.83-3.13 8.06-7 9z"/>
                    </svg>
                    Pay ₹{actualPayment.toLocaleString('en-IN')} via UPI
                  </a>

                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Click to open your UPI app (PhonePe, GPay, Paytm, etc.)
                  </p>
                </div>
              )}

              {/* QR Code Payment */}
              {upiMethod === 'qr' && upiSettings.upiQrCodeUrl && (
                <div className="space-y-3">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center font-semibold">Scan QR Code to Pay</p>
                    <div className="flex justify-center">
                      <img 
                        src={upiSettings.upiQrCodeUrl} 
                        alt="UPI QR Code" 
                        className="w-48 h-48 object-contain border-2 border-gray-200 dark:border-gray-700 rounded-lg"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'block'
                        }}
                      />
                      <div style={{ display: 'none' }} className="text-center text-sm text-red-500 p-4">
                        QR Code failed to load
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-xs text-center text-blue-700 dark:text-blue-300">
                        <strong>Amount to Pay:</strong> ₹{actualPayment.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">UPI ID (for manual entry)</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-gray-900 dark:text-white break-all">
                        {upiSettings.upiId}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(upiSettings.upiId)
                          toast.success('UPI ID copied!')
                        }}
                        className="flex-shrink-0 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Copy UPI ID"
                      >
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Open any UPI app and scan the QR code above
                  </p>
                </div>
              )}

              {/* Fallback if QR method selected but no QR code URL */}
              {upiMethod === 'qr' && !upiSettings.upiQrCodeUrl && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    ⚠️ QR Code not available. Please use "Pay via Link" option or contact school admin.
                  </p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">📝 After Payment:</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Enter the transaction/reference ID below and submit for verification
                </p>
              </div>
            </div>
          )}

          {/* Credit Card Payment Section - Only show if Credit Card is selected AND not partial payment */}
          {rowsToSubmit.length > 0 && form.paymentMode === 'Credit Card' && !form.isPartialPayment && (
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-purple-900 dark:text-purple-100 text-sm">Pay via Credit Card</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Secure Online Payment Gateway</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 text-center">
                    <strong>Amount to Pay:</strong> ₹{actualPayment.toLocaleString('en-IN')}
                  </p>
                  
                  <a
                    href="https://rzp.io/rzp/anandspecialschoolpaymentpage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Open Credit Card Payment Page
                    <HiExternalLink className="w-4 h-4" />
                  </a>

                  <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Secure</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>SSL Encrypted</span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-100 dark:bg-purple-900/40 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">💳 Accepted Cards:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-medium text-gray-700 dark:text-gray-300">Visa</span>
                    <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-medium text-gray-700 dark:text-gray-300">Mastercard</span>
                    <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-medium text-gray-700 dark:text-gray-300">RuPay</span>
                    <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-medium text-gray-700 dark:text-gray-300">Amex</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">📝 After Payment:</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  After completing payment, copy the transaction ID from the payment gateway and enter it below for verification
                </p>
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
  
  // Extract UPI settings for payment modal
  const upiSettings = {
    upiId: settings?.upiId || 'anandspecialschoolsurat@sbi',  // Fallback to default
    upiPayeeName: settings?.upiPayeeName || 'Anand Special School',
    upiQrCodeUrl: settings?.upiQrCodeUrl || '',
  }

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
          upiSettings={upiSettings}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
