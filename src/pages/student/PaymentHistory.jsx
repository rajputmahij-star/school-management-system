import React, { useState, useEffect } from 'react'
import { HiReceiptTax, HiCheckCircle, HiX, HiClock, HiDownload } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { getPaymentRequests } from '../../firebase/firestore'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { generateRequestReceipt } from '../../utils/pdfExport'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const StatusBadge = ({ status }) => {
  if (status === 'Paid')
    return <span className="badge-success flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" />Paid & Verified</span>
  if (status === 'Verification Pending')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><HiClock className="w-3.5 h-3.5" />Verification Pending</span>
  if (status === 'Rejected')
    return <span className="badge-danger flex items-center gap-1"><HiX className="w-3.5 h-3.5" />Rejected</span>
  return <span className="badge-warning">{status}</span>
}

export default function PaymentHistory() {
  const { userData } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const uid = userData?.uid || userData?.id
    if (uid) load(uid)
  }, [userData])

  const load = async (uid) => {
    try {
      setRequests(await getPaymentRequests(uid))
    } catch (err) {
      toast.error('Failed to load payment history')
    } finally { setLoading(false) }
  }

  // Group requests by reference ID and payment type (for quarterly/half-yearly/yearly payments)
  const groupedRequests = React.useMemo(() => {
    const grouped = []
    const processed = new Set()

    requests.forEach((req) => {
      if (processed.has(req.id)) return

      // For quarterly/half-yearly/yearly payments with same reference ID, group them
      if (req.paymentType && ['Quarterly', 'Half-Yearly', 'Yearly'].includes(req.paymentType) && req.referenceId) {
        // Find all requests with same student, reference ID, payment type, and status
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
            id: req.id,
            billingPeriod: `${relatedRequests.length} months`,
            periodDetails: periods, // Store full period list
            baseAmount: totalBase,
            lateFee: totalLateFee,
            totalAmount: totalAmount,
            isGrouped: true,
            monthCount: relatedRequests.length
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

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment History</h1>
        <p className="text-sm text-gray-500 mt-0.5">All your fee payment submissions and their verification status</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xl font-bold text-yellow-600">
            {requests.filter((r) => r.status === 'Verification Pending').length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Awaiting Verification</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {requests.filter((r) => r.status === 'Paid').length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Approved</p>
        </div>
      </div>

      {/* Records */}
      <div className="card overflow-hidden">
        {groupedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <HiReceiptTax className="w-12 h-12 mb-3 opacity-30" />
            <p>No payment submissions yet</p>
            <p className="text-xs mt-1">Use the Fees page to submit a payment after paying at school.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="table-header">Submitted</th>
                  <th className="table-header">Billing Period</th>
                  <th className="table-header hidden sm:table-cell">Type</th>
                  <th className="table-header">Tuition Fee</th>
                  <th className="table-header hidden sm:table-cell">Late Fee (if any)</th>
                  <th className="table-header">Total</th>
                  <th className="table-header hidden md:table-cell">Reference ID</th>
                  <th className="table-header hidden md:table-cell">Payment Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {groupedRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell text-sm text-gray-500">{formatDate(r.submittedAt)}</td>
                    <td className="table-cell">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{r.billingPeriod}</p>
                      {r.isGrouped && r.periodDetails && (
                        <p className="text-xs text-blue-500 mt-0.5" title={r.periodDetails}>
                          {r.paymentType} payment
                        </p>
                      )}
                      {!r.isGrouped && r.periodKey && <p className="text-xs text-gray-400 font-mono">{r.periodKey}</p>}
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="badge-info">{r.paymentType}</span>
                    </td>
                    <td className="table-cell">{formatCurrency(r.baseAmount)}</td>
                    <td className="table-cell hidden sm:table-cell">
                      {r.lateFee > 0
                        ? <span className="text-red-500">{formatCurrency(r.lateFee)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-cell font-semibold">{formatCurrency(r.totalAmount)}</td>
                    <td className="table-cell hidden md:table-cell text-xs text-gray-600 dark:text-gray-400 font-mono">{r.referenceId || '—'}</td>
                    <td className="table-cell hidden md:table-cell text-sm text-gray-500">{r.paymentDate || '—'}</td>
                    <td className="table-cell">
                      <div className="space-y-1">
                        <StatusBadge status={r.status} />
                        {r.status === 'Rejected' && r.rejectionReason && (
                          <p className="text-xs text-red-500">{r.rejectionReason}</p>
                        )}
                        {r.status === 'Paid' && r.verifiedAt && (
                          <p className="text-xs text-gray-400">Verified {formatDate(r.verifiedAt)}</p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      {r.status === 'Paid' ? (
                        <button
                          onClick={() => generateRequestReceipt(r, userData)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 font-medium"
                          title="Download Receipt"
                        >
                          <HiDownload className="w-4 h-4" /> Receipt
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
