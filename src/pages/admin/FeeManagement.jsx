import React, { useState, useEffect, useMemo } from 'react'
import {
  HiSearch, HiRefresh, HiExclamation, HiCheckCircle, HiClock,
  HiChevronDown, HiChevronUp, HiX, HiThumbUp, HiThumbDown,
  HiShieldExclamation, HiFilter,
} from 'react-icons/hi'
import {
  getStudents, getFeeRules, getSettings, getFeeSettings,
  getAllFeeLedger, getPaymentRequests, updatePaymentRequest,
  upsertFeeLedgerEntry, addFineWaiver,
} from '../../firebase/firestore'
import { formatDate, formatCurrency, calculateStudentFee, paginate, getFeeStartDate, isNiosGroup } from '../../utils/helpers'
import { generatePeriods, mergeLedger, BILLING_TYPES, calcLateFee } from '../../utils/feeEngine'
import Pagination from '../../components/ui/Pagination'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

/** Get effective monthly fee for a student — NIOS uses niosFee, others use fee rules */
const getEffectiveFee = (feeRules, student) => {
  if (isNiosGroup(student.className) && student.niosFee) return Number(student.niosFee)
  return calculateStudentFee(feeRules, student).fee || 0
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, daysLate }) => {
  if (status === 'Paid')                 return <span className="badge-success">Paid</span>
  if (status === 'Advance Paid')         return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Advance Paid</span>
  if (status === 'Verification Pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><HiClock className="w-3 h-3" />Verification Pending</span>
  if (status === 'Rejected')             return <span className="badge-danger">Rejected</span>
  if (daysLate > 0)                      return <span className="badge-danger">Late</span>
  return                                        <span className="badge-warning">Pending</span>
}

// ─── Expandable ledger row per student ───────────────────────────────────────
const StudentLedgerRow = ({ student, feeRules, ledgerEntries, feeSettings, settings }) => {
  const [open, setOpen] = useState(false)
  const baseFee       = useMemo(() => getEffectiveFee(feeRules, student), [feeRules, student])
  const customDueDate = student.customDueDate || null
  const lateFeeBase   = settings?.lateFeeBase   || 250
  const lateFeePerDay = settings?.lateFeePerDay || 25

  // Derive billing type from actual ledger entries (what parent has actually paid)
  // or default to Monthly for display purposes
  const ledgerBillingTypes = useMemo(() => {
    const types = new Set(ledgerEntries.map((e) => e.billingType).filter(Boolean))
    return types.size > 0 ? [...types] : ['Monthly']
  }, [ledgerEntries])

  // Build merged rows across all billing types found in ledger
  const merged = useMemo(() => {
    if (!baseFee) return []
    const lateFeeBase   = settings?.lateFeeBase   || 250
    const lateFeePerDay = settings?.lateFeePerDay || 25
    const ledgerMap = {}
    ledgerEntries.forEach((e) => { ledgerMap[e.periodKey] = e })
    // Show Monthly periods by default for admin overview
    const periods = generatePeriods('Monthly', getFeeStartDate(student), baseFee, customDueDate, feeSettings)
    const caseHistoryDate = getFeeStartDate(student) // Use the fee start date as case history date
    return mergeLedger(periods, ledgerMap, lateFeeBase, lateFeePerDay, caseHistoryDate)
  }, [student, baseFee, customDueDate, feeSettings, ledgerEntries, settings])

  const paidCount    = merged.filter((r) => r.status === 'Paid').length
  const pendingCount = merged.filter((r) => r.status !== 'Paid').length
  const totalDue     = merged.filter((r) => r.status !== 'Paid').reduce((s, r) => s + r.totalPayable, 0)

  // Detect advance paid: paid periods whose due date is in the future
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const advancePaidCount = merged.filter((r) => r.status === 'Paid' && r.dueDate && new Date(r.dueDate) > today).length

  // Enrich merged rows with Advance Paid status for display
  const enriched = merged.map((r) => ({
    ...r,
    displayStatus: (r.status === 'Paid' && r.dueDate && new Date(r.dueDate) > today)
      ? 'Advance Paid'
      : r.status,
  }))

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <td className="table-cell">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600">
              {student.studentName?.[0]}
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{student.studentName}</p>
              <p className="text-xs text-gray-500">{student.studentId}</p>
            </div>
          </div>
        </td>
        <td className="table-cell hidden sm:table-cell text-sm">{student.className}</td>
        <td className="table-cell text-sm font-medium">{baseFee ? formatCurrency(baseFee) : <span className="text-gray-400 text-xs">No rule</span>}</td>
        <td className="table-cell hidden lg:table-cell">
          <div className="flex gap-2 text-xs flex-wrap">
            <span className="text-green-600 font-medium">{paidCount} paid</span>
            {advancePaidCount > 0 && <span className="text-purple-600 font-medium">{advancePaidCount} advance</span>}
            <span className="text-yellow-600 font-medium">{pendingCount} due</span>
          </div>
        </td>
        <td className="table-cell">
          {totalDue > 0
            ? <span className="font-bold text-red-500 text-sm">{formatCurrency(totalDue)}</span>
            : <span className="text-green-600 font-medium text-sm">All clear</span>}
        </td>
        <td className="table-cell text-right pr-4">
          {open ? <HiChevronUp className="w-4 h-4 text-gray-400 ml-auto" /> : <HiChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-gray-50 dark:bg-gray-900/40 px-4 pb-4 pt-2">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 text-xs">
                    {['Period','Due Date','Tuition Fee','Days Late','Late Fee (if any)','Total Payable','Status','Paid On'].map((h) => (
                      <th key={h} className="text-left p-3 font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {enriched.length === 0
                    ? <tr><td colSpan={8} className="p-4 text-center text-gray-400">No periods generated.</td></tr>
                    : enriched.map((row) => (
                      <tr key={row.periodKey} className={`hover:bg-white dark:hover:bg-gray-800 ${row.displayStatus === 'Advance Paid' ? 'bg-purple-50/40 dark:bg-purple-900/10' : row.status !== 'Paid' && row.daysLate > 0 ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                        <td className="p-3 font-medium text-gray-900 dark:text-white">{row.label}</td>
                        <td className="p-3 text-gray-500">{row.dueDate ? format(row.dueDate, 'dd MMM yyyy') : '—'}</td>
                        <td className="p-3">{formatCurrency(row.baseFee)}</td>
                        <td className="p-3">{row.daysLate > 0 ? <span className="text-red-500">{row.daysLate}d</span> : <span className="text-gray-400">—</span>}</td>
                        <td className="p-3">{row.fine > 0 ? <span className="text-red-500">{formatCurrency(row.fine)}</span> : <span className="text-gray-400">—</span>}</td>
                        <td className="p-3 font-bold">{formatCurrency(row.totalPayable)}</td>
                        <td className="p-3"><StatusBadge status={row.displayStatus} daysLate={row.daysLate} /></td>
                        <td className="p-3 text-xs text-gray-400">{row.paidAt ? formatDate(row.paidAt) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Reject modal ─────────────────────────────────────────────────────────────
const RejectModal = ({ request, onClose, onDone }) => {
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)

  const REASONS = ['Invalid Reference ID', 'Payment Not Received', 'Incorrect Amount', 'Duplicate Submission']

  const handleReject = async () => {
    if (!reason.trim()) { toast.error('Enter a rejection reason'); return }
    setSaving(true)
    try {
      await updatePaymentRequest(request.id, {
        status:          'Rejected',
        rejectionReason: reason.trim(),
        verifiedAt:      Timestamp.fromDate(new Date()),
      })
      toast.success('Payment rejected')
      onDone()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title="Reject Payment" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rejecting payment for <strong>{request.studentName}</strong> — {request.billingPeriod}
        </p>
        <div>
          <label className="label">Reason for Rejection</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field mb-2"
          >
            <option value="">Select a reason…</option>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field"
            placeholder="Or type a custom reason"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleReject} disabled={saving} className="btn-primary flex-1 justify-center bg-red-600 hover:bg-red-700">
            {saving ? <LoadingSpinner size="sm" /> : <><HiThumbDown className="w-4 h-4" /> Reject</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Fine Waiver Modal ────────────────────────────────────────────────────────
const FineWaiverModal = ({ students, feeRules, ledger, feeSettings, settings, adminUser, onClose, onDone }) => {
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedPeriods, setSelectedPeriods] = useState([]) // array of periodKeys
  const [reason,  setReason]  = useState('')
  const [saving,  setSaving]  = useState(false)

  const lateFeeBase   = settings?.lateFeeBase   || 250
  const lateFeePerDay = settings?.lateFeePerDay || 25

  // Build per-student ledger map
  const ledgerByStudent = useMemo(() => {
    const map = {}
    ledger.forEach((e) => { if (!map[e.studentId]) map[e.studentId] = []; map[e.studentId].push(e) })
    return map
  }, [ledger])

  // Get unpaid-with-fine periods for the selected student
  const unwaivablePeriods = useMemo(() => {
    if (!selectedStudent) return []
    const s = students.find((st) => (st.uid || st.id) === selectedStudent)
    if (!s) return []
    const { fee: ruleMonthlyFee } = calculateStudentFee(feeRules, s)
    const baseFee = s.niosFee || s.monthlyFee || ruleMonthlyFee || 0
    if (!baseFee || !getFeeStartDate(s)) return []
    // Use Monthly by default for waiver calculation
    const periods  = generatePeriods('Monthly', getFeeStartDate(s), baseFee, s.customDueDate || null, feeSettings)
    const lmap = {}
    ;(ledgerByStudent[selectedStudent] || []).forEach((e) => { lmap[e.periodKey] = e })
    const caseHistoryDate = getFeeStartDate(s)
    const merged = mergeLedger(periods, lmap, lateFeeBase, lateFeePerDay, caseHistoryDate)
    // Only unpaid periods that have a late fine AND are not already waived
    return merged.filter((r) => r.status !== 'Paid' && r.fine > 0 && !lmap[r.periodKey]?.waivedFine)
  }, [selectedStudent, students, feeRules, ledgerByStudent, feeSettings, lateFeeBase, lateFeePerDay])

  const togglePeriod = (key) =>
    setSelectedPeriods((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key])

  const handleApply = async () => {
    if (!selectedStudent)        { toast.error('Select a student'); return }
    if (!selectedPeriods.length) { toast.error('Select at least one period'); return }
    setSaving(true)
    try {
      const adminName = adminUser?.adminName || adminUser?.name || 'Admin'
      const adminId   = adminUser?.uid || adminUser?.id || ''
      const now       = Timestamp.fromDate(new Date())

      for (const key of selectedPeriods) {
        const period = unwaivablePeriods.find((p) => p.periodKey === key)
        if (!period) continue
        const waivedAmount = period.fine

        // 1. Update fee_ledger — set fine = 0, waivedFine = original, recalc totalPayable
        await upsertFeeLedgerEntry(selectedStudent, key, {
          billingType:  period.billingType,
          baseFee:      period.baseFee,
          fine:         0,
          waivedFine:   waivedAmount,
          totalPayable: period.baseFee,
          status:       'Pending',
          waivedAt:     now,
          waivedBy:     adminName,
        })

        // 2. Write to fine_waivers collection
        await addFineWaiver({
          studentId:    selectedStudent,
          periodKey:    key,
          billingPeriod: period.label,
          waivedAmount,
          adminId,
          adminName,
          reason:       reason.trim() || '',
          createdAt:    now,
        })
      }

      toast.success(`Fine waiver applied to ${selectedPeriods.length} period(s)`)
      onDone()
    } catch (err) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title="Emergency Fine Waiver" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Waive late fees for selected billing periods. The base tuition fee remains unchanged.
        </p>

        {/* Student selector */}
        <div>
          <label className="label">Select Student</label>
          <select
            value={selectedStudent}
            onChange={(e) => { setSelectedStudent(e.target.value); setSelectedPeriods([]) }}
            className="input-field"
          >
            <option value="">— Select a student —</option>
            {students.map((s) => (
              <option key={s.uid || s.id} value={s.uid || s.id}>
                {s.studentName} ({s.studentId})
              </option>
            ))}
          </select>
        </div>

        {/* Periods with fines */}
        {selectedStudent && (
          unwaivablePeriods.length === 0 ? (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
              <HiCheckCircle className="w-4 h-4" />
              No outstanding late fees for this student.
            </div>
          ) : (
            <div>
              <label className="label">Select Periods to Waive</label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {unwaivablePeriods.map((p) => (
                  <label
                    key={p.periodKey}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      selectedPeriods.includes(p.periodKey)
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPeriods.includes(p.periodKey)}
                        onChange={() => togglePeriod(p.periodKey)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.label}</p>
                        <p className="text-xs text-gray-500">Base: {formatCurrency(p.baseFee)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">{formatCurrency(p.fine)}</p>
                      <p className="text-xs text-gray-400">late fee</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Preview of effect */}
              {selectedPeriods.length > 0 && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-orange-700 dark:text-orange-300">Waiver Preview</p>
                  {selectedPeriods.map((key) => {
                    const p = unwaivablePeriods.find((x) => x.periodKey === key)
                    return p ? (
                      <div key={key} className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>{p.label}</span>
                        <span className="line-through text-red-400">{formatCurrency(p.fine)}</span>
                        <span className="text-green-600 font-semibold">→ ₹0</span>
                        <span className="font-semibold">Total: {formatCurrency(p.baseFee)}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* Optional reason */}
        <div>
          <label className="label">Reason <span className="text-xs text-gray-400">(optional)</span></label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field"
            placeholder="e.g. Financial hardship, School error, etc."
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={handleApply}
            disabled={saving || !selectedPeriods.length}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? <LoadingSpinner size="sm" /> : <HiShieldExclamation className="w-4 h-4" />}
            Apply Waiver
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeeManagement() {
  const { userData: adminUser } = useAuth()
  const [tab,          setTab]          = useState('ledger') // 'ledger' | 'requests'
  const [students,     setStudents]     = useState([])
  const [feeRules,     setFeeRules]     = useState([])
  const [settings,     setSettings]     = useState({})
  const [feeSettings,  setFeeSettings]  = useState({})
  const [ledger,       setLedger]       = useState([])
  const [requests,     setRequests]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterBilling,setFilterBilling]= useState('all') // payment type filter
  const [filterStatus, setFilterStatus] = useState('all') // fee status filter
  const [page,         setPage]         = useState(1)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [approving,    setApproving]    = useState(null)
  const [waiverOpen,   setWaiverOpen]   = useState(false)
  const [expandedRows, setExpandedRows] = useState(new Set()) // Track which grouped rows are expanded

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [s, r, cfg, feeCfg, l, reqs] = await Promise.all([
        getStudents(), getFeeRules(), getSettings(), getFeeSettings(),
        getAllFeeLedger(), getPaymentRequests(),
      ])
      setStudents(s.filter((st) => !st.leaveDate))
      setFeeRules(r)
      setSettings(cfg || {})
      setFeeSettings(feeCfg || {})
      setLedger(l)
      setRequests(reqs)
    } catch (err) {
      toast.error(`Failed to load data: ${err.message}`)
    } finally { setLoading(false) }
  }

  // Pending requests (only show Verification Pending)
  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'Verification Pending'),
    [requests]
  )

  // Group requests by reference ID and payment type (for quarterly/half-yearly payments)
  const groupedRequests = useMemo(() => {
    const grouped = []
    const processed = new Set()

    requests.forEach((req) => {
      if (processed.has(req.id)) return

      // For quarterly/half-yearly/annual payments with same reference ID, group them
      if (req.paymentType && ['Quarterly', 'Half-Yearly', 'Annual'].includes(req.paymentType) && req.referenceId) {
        // Find all requests with same student, reference ID, and payment type
        const relatedRequests = requests.filter((r) => 
          r.studentId === req.studentId &&
          r.referenceId === req.referenceId &&
          r.paymentType === req.paymentType &&
          r.status === req.status
        )

        if (relatedRequests.length > 1) {
          // Create a grouped entry
          const totalBase = relatedRequests.reduce((sum, r) => sum + (r.baseAmount || 0), 0)
          const totalLateFee = relatedRequests.reduce((sum, r) => sum + (r.lateFee || 0), 0)
          const totalAmount = relatedRequests.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
          const periods = relatedRequests.map(r => r.billingPeriod).join(', ')

          grouped.push({
            ...req,
            id: req.id, // Use first request's ID for approval/reject
            billingPeriod: periods,
            baseAmount: totalBase,
            lateFee: totalLateFee,
            totalAmount: totalAmount,
            isGrouped: true,
            groupedIds: relatedRequests.map(r => r.id),
            groupedRequests: relatedRequests
          })

          // Mark all related requests as processed
          relatedRequests.forEach(r => processed.add(r.id))
        } else {
          grouped.push(req)
          processed.add(req.id)
        }
      } else {
        grouped.push(req)
        processed.add(req.id)
      }
    })

    return grouped
  }, [requests])

  // Ledger by student
  const ledgerByStudent = useMemo(() => {
    const map = {}
    ledger.forEach((e) => {
      if (!map[e.studentId]) map[e.studentId] = []
      map[e.studentId].push(e)
    })
    return map
  }, [ledger])

  // Stats
  const stats = useMemo(() => {
    const lateFeeBase   = settings?.lateFeeBase   || 250
    const lateFeePerDay = settings?.lateFeePerDay || 25
    const todayTs = new Date(); todayTs.setHours(0, 0, 0, 0)
    let totalDue = 0, lateCount = 0, paidCount = 0, pendingCount = 0, advanceCount = 0
    students.forEach((s) => {
      const baseFee = getEffectiveFee(feeRules, s)
      if (!baseFee) return
      const periods = generatePeriods('Monthly', getFeeStartDate(s), baseFee, s.customDueDate || null, feeSettings)
      const lmap = {}
      ;(ledgerByStudent[s.uid || s.id] || []).forEach((e) => { lmap[e.periodKey] = e })
      const caseHistoryDate = getFeeStartDate(s)
      mergeLedger(periods, lmap, lateFeeBase, lateFeePerDay, caseHistoryDate).forEach((r) => {
        const isAdvance = r.status === 'Paid' && r.dueDate && new Date(r.dueDate) > todayTs
        if (isAdvance) { advanceCount++ }
        else if (r.status === 'Paid') paidCount++
        else if (r.daysLate > 0) { lateCount++; totalDue += r.totalPayable }
        else { pendingCount++; totalDue += r.totalPayable }
      })
    })
    return { totalDue, lateCount, paidCount, pendingCount, advanceCount }
  }, [students, feeRules, feeSettings, ledgerByStudent, settings])

  // Filter students by search, payment type, and fee status
  const filtered = useMemo(() => {
    const todayTs = new Date()
    todayTs.setHours(0, 0, 0, 0)
    const lb = settings?.lateFeeBase   || 250
    const lp = settings?.lateFeePerDay || 25

    return students.filter((s) => {
      // Search filter
      const q = search.toLowerCase()
      if (q && ![s.studentName, s.studentId, s.className].some((v) => v?.toLowerCase().includes(q))) return false

      // Payment type filter (billing type on the student or their ledger entries)
      if (filterBilling !== 'all') {
        const studentBillingType = s.billingType || 'Monthly'
        if (studentBillingType !== filterBilling) return false
      }

      // Fee status filter — requires computing merged ledger for this student
      if (filterStatus !== 'all') {
        const baseFee = getEffectiveFee(feeRules, s)
        if (!baseFee) return false
        const periods = generatePeriods('Monthly', getFeeStartDate(s), baseFee, s.customDueDate || null, feeSettings)
        const lmap = {}
        ;(ledgerByStudent[s.uid || s.id] || []).forEach((e) => { lmap[e.periodKey] = e })
        const caseHistoryDate = getFeeStartDate(s)
        const rows = mergeLedger(periods, lmap, lb, lp, caseHistoryDate)

        if (filterStatus === 'paid') {
          // student has at least one paid period (non-advance)
          return rows.some((r) => r.status === 'Paid' && !(r.dueDate && new Date(r.dueDate) > todayTs))
        }
        if (filterStatus === 'pending') {
          return rows.some((r) => r.status !== 'Paid' && r.status !== 'Verification Pending')
        }
        if (filterStatus === 'advance') {
          return rows.some((r) => r.status === 'Paid' && r.dueDate && new Date(r.dueDate) > todayTs)
        }
      }

      return true
    })
  }, [students, search, filterBilling, filterStatus, feeRules, feeSettings, ledgerByStudent, settings])

  const paged = useMemo(() => paginate(filtered, page, 12), [filtered, page])

  // Toggle expanded state for grouped payment rows
  const toggleExpanded = (reqId) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(reqId)) {
        newSet.delete(reqId)
      } else {
        newSet.add(reqId)
      }
      return newSet
    })
  }

  // Approve a payment request (or grouped requests for quarterly payments)
  const handleApprove = async (req) => {
    setApproving(req.id)
    try {
      const now = Timestamp.fromDate(new Date())
      const adminName = adminUser?.adminName || adminUser?.name || 'Admin'

      // If this is a grouped request (quarterly/half-yearly/annual), approve all related requests
      const requestsToApprove = req.isGrouped ? req.groupedRequests : [req]

      for (const request of requestsToApprove) {
        // 1. Mark the payment_request as Paid
        await updatePaymentRequest(request.id, {
          status:          'Paid',
          verifiedBy:      adminName,
          verifiedAt:      now,
          rejectionReason: null,
        })

        // 2. Upsert the fee_ledger entry — creates it if it doesn't exist yet
        await upsertFeeLedgerEntry(request.studentId, request.periodKey, {
          billingType: request.paymentType,
          baseFee:     request.baseAmount,
          fine:        request.lateFee || 0,
          totalPayable: request.totalAmount,
          status:      'Paid',
          amountPaid:  request.totalAmount,
          paidAt:      now,
          verifiedBy:  adminName,
          referenceId: request.referenceId,
          paymentDate: request.paymentDate,
        })
      }

      const periodLabel = req.isGrouped ? `${requestsToApprove.length} periods` : req.billingPeriod
      toast.success(`${req.studentName} — ${periodLabel} approved!`)
      loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally { setApproving(null) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fee ledger and payment verification</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWaiverOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
          >
            <HiShieldExclamation className="w-4 h-4" /> Emergency Fine Waiver
          </button>
          <button onClick={loadAll} className="btn-secondary text-sm"><HiRefresh className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Students',  value: students.length,        color: 'text-gray-700 dark:text-gray-200' },
          { label: 'Paid Periods',    value: stats.paidCount,        color: 'text-green-600' },
          { label: 'Advance Paid',    value: stats.advanceCount,     color: 'text-purple-600' },
          { label: 'Pending',         value: stats.pendingCount,     color: 'text-yellow-600' },
          { label: 'Late',            value: stats.lateCount,        color: 'text-red-500' },
          { label: 'Awaiting Verify', value: pendingRequests.length, color: pendingRequests.length > 0 ? 'text-orange-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('ledger')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'ledger' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        >
          Fee Ledger
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'requests' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
        >
          Payment Verification
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Fee Ledger ── */}
      {tab === 'ledger' && (
        <>
          {feeRules.length === 0 && !loading && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-start gap-3">
              <HiExclamation className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">No fee rules configured. Go to <strong>Fee Rules</strong> to set up brackets.</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search student…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="input-field pl-9" />
            </div>
            {/* Fee Status Filter */}
            <div className="flex items-center gap-1.5">
              <HiFilter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {[
                { v: 'all',     label: 'All' },
                { v: 'pending', label: 'Pending' },
                { v: 'paid',    label: 'Paid' },
                { v: 'advance', label: 'Advance Paid' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => { setFilterStatus(v); setPage(1) }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterStatus === v ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* Payment Type Filter */}
            <div className="flex items-center gap-1.5">
              {[
                { v: 'all',       label: 'All Types' },
                { v: 'Monthly',   label: 'Monthly' },
                { v: 'Quarterly', label: 'Quarterly' },
                { v: 'Yearly',    label: 'Yearly' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => { setFilterBilling(v); setPage(1) }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterBilling === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="table-header">Student</th>
                        <th className="table-header hidden sm:table-cell">Class</th>
                        <th className="table-header">Tuition Fee</th>
                        <th className="table-header hidden lg:table-cell">Periods</th>
                        <th className="table-header">Total Amount</th>
                        <th className="table-header"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {paged.data.length === 0
                        ? <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-12">No students found</td></tr>
                        : paged.data.map((s) => (
                          <StudentLedgerRow
                            key={s.uid || s.id}
                            student={s}
                            feeRules={feeRules}
                            ledgerEntries={ledgerByStudent[s.uid || s.id] || []}
                            feeSettings={feeSettings}
                            settings={settings}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm text-gray-500">
                  <span>Showing {paged.data.length} of {paged.total} students</span>
                  <Pagination currentPage={page} totalPages={paged.totalPages} onPageChange={setPage} />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Payment Verification ── */}
      {tab === 'requests' && (
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          : groupedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <HiCheckCircle className="w-12 h-12 mb-3 opacity-30" />
              <p>No payment requests yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="table-header">Student</th>
                    <th className="table-header hidden sm:table-cell">Class</th>
                    <th className="table-header">Period</th>
                    <th className="table-header hidden md:table-cell">Type</th>
                    <th className="table-header">Base</th>
                    <th className="table-header hidden lg:table-cell">Late Fee (if any)</th>
                    <th className="table-header">Total</th>
                    <th className="table-header hidden md:table-cell">Reference ID</th>
                    <th className="table-header hidden lg:table-cell">Pay Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {groupedRequests.map((req) => (
                    <React.Fragment key={req.id}>
                      <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${req.status === 'Verification Pending' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                        <td className="table-cell">
                          <p className="font-medium text-sm text-gray-900 dark:text-white">{req.studentName}</p>
                          <p className="text-xs text-gray-400">{formatDate(req.submittedAt)}</p>
                        </td>
                        <td className="table-cell hidden sm:table-cell text-sm text-gray-500">{req.className}</td>
                        <td className="table-cell">
                          {req.isGrouped ? (
                            <div>
                              <button
                                onClick={() => toggleExpanded(req.id)}
                                className="flex items-center gap-2 text-left hover:text-blue-600 transition-colors"
                              >
                                {expandedRows.has(req.id) ? (
                                  <HiChevronUp className="w-4 h-4 flex-shrink-0" />
                                ) : (
                                  <HiChevronDown className="w-4 h-4 flex-shrink-0" />
                                )}
                                <div>
                                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                                    {req.groupedRequests.length} months combined
                                  </p>
                                  <p className="text-xs text-blue-500 mt-0.5">Click to {expandedRows.has(req.id) ? 'collapse' : 'expand'}</p>
                                </div>
                              </button>
                            </div>
                          ) : (
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{req.billingPeriod}</p>
                          )}
                        </td>
                        <td className="table-cell hidden md:table-cell"><span className="badge-info">{req.paymentType}</span></td>
                        <td className="table-cell text-sm">{formatCurrency(req.baseAmount)}</td>
                        <td className="table-cell hidden lg:table-cell">
                          {req.lateFee > 0 ? <span className="text-red-500 text-sm">{formatCurrency(req.lateFee)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-cell font-bold text-sm">{formatCurrency(req.totalAmount)}</td>
                        <td className="table-cell hidden md:table-cell text-xs font-mono text-gray-600 dark:text-gray-400">{req.referenceId}</td>
                        <td className="table-cell hidden lg:table-cell text-sm text-gray-500">{req.paymentDate || '—'}</td>
                        <td className="table-cell">
                          <div className="space-y-1">
                            <StatusBadge status={req.status} />
                            {req.status === 'Rejected' && req.rejectionReason && (
                              <p className="text-xs text-red-400">{req.rejectionReason}</p>
                            )}
                            {req.status === 'Paid' && req.verifiedBy && (
                              <p className="text-xs text-gray-400">By {req.verifiedBy}</p>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          {req.status === 'Verification Pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(req)}
                                disabled={approving === req.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                              >
                                {approving === req.id ? <LoadingSpinner size="sm" /> : '✓'} Approve
                              </button>
                              <button
                                onClick={() => setRejectTarget(req)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
                              >
                                ✕ Decline
                              </button>
                            </div>
                          )}
                          {req.status !== 'Verification Pending' && <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                      {/* Expanded view for grouped requests */}
                      {req.isGrouped && expandedRows.has(req.id) && (
                        <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                          <td colSpan={11} className="p-0">
                            <div className="px-4 py-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Individual Months:</p>
                              <div className="space-y-2">
                                {req.groupedRequests.map((subReq, idx) => (
                                  <div key={subReq.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-4">
                                      <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{subReq.billingPeriod}</p>
                                        <p className="text-xs text-gray-500">Period Key: {subReq.periodKey}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <div className="text-right">
                                        <p className="text-xs text-gray-500">Base Fee</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(subReq.baseAmount)}</p>
                                      </div>
                                      {subReq.lateFee > 0 && (
                                        <div className="text-right">
                                          <p className="text-xs text-gray-500">Late Fee</p>
                                          <p className="text-sm font-medium text-red-500">{formatCurrency(subReq.lateFee)}</p>
                                        </div>
                                      )}
                                      <div className="text-right">
                                        <p className="text-xs text-gray-500">Total</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(subReq.totalAmount)}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); loadAll() }}
        />
      )}

      {/* Fine Waiver modal */}
      {waiverOpen && (
        <FineWaiverModal
          students={students}
          feeRules={feeRules}
          ledger={ledger}
          feeSettings={feeSettings}
          settings={settings}
          adminUser={adminUser}
          onClose={() => setWaiverOpen(false)}
          onDone={() => { setWaiverOpen(false); loadAll() }}
        />
      )}
    </div>
  )
}
