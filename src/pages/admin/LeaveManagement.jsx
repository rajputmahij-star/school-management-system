import React, { useState, useEffect, useCallback } from 'react'
import { HiCheckCircle, HiX, HiClock, HiRefresh } from 'react-icons/hi'
import {
  getLeaveRequests, updateLeaveRequest, getStudentLeaves,
  getEmployees, saveEmployeeAttendance,
} from '../../firebase/firestore'
import { formatDate } from '../../utils/helpers'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { format, parseISO, eachDayOfInterval } from 'date-fns'

const StatusBadge = ({ status }) => {
  if (status === 'Approved') return <span className="badge-success flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" />Approved</span>
  if (status === 'Rejected') return <span className="badge-danger flex items-center gap-1"><HiX className="w-3.5 h-3.5" />Rejected</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><HiClock className="w-3.5 h-3.5" />Pending</span>
}

// ─── Reject dialog ────────────────────────────────────────────────────────────
const RejectDialog = ({ request, onClose, onDone }) => {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const { userData: admin } = useAuth()

  const handleReject = async () => {
    if (!reason.trim()) { toast.error('Enter a rejection reason'); return }
    setSaving(true)
    try {
      await updateLeaveRequest(request.id, {
        status: 'Rejected',
        rejectionReason: reason.trim(),
        reviewedBy: admin?.adminName || admin?.name || 'Admin',
        reviewedAt: Timestamp.fromDate(new Date()),
      })
      toast.success('Request rejected')
      onDone()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title="Reject Leave Request" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rejecting leave for <strong>{request.employeeName}</strong> ({request.fromDate} → {request.toDate})
        </p>
        <div>
          <label className="label">Reason for Rejection</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            className="input-field resize-none" rows={2} placeholder="e.g. Insufficient staff coverage" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleReject} disabled={saving} className="btn-danger flex-1 justify-center">
            {saving ? <LoadingSpinner size="sm" /> : 'Reject'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Expandable dates cell ────────────────────────────────────────────────────
const DatesCell = ({ req }) => {
  const [open, setOpen] = useState(false)

  if (!req.dates?.length) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{req.fromDate}</p>
        <p className="text-xs text-gray-500">to {req.toDate}</p>
      </div>
    )
  }

  const total  = req.dates.length
  const shown  = req.dates.slice(0, 2)
  const hidden = total - 2

  return (
    <>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{total} day{total > 1 ? 's' : ''}</p>
        <p className="text-xs text-gray-500">
          {shown.map((d) => format(parseISO(d), 'dd MMM')).join(', ')}
          {hidden > 0 && (
            <button onClick={() => setOpen(true)}
              className="ml-1 text-primary-600 dark:text-primary-400 hover:underline font-medium">
              +{hidden} more
            </button>
          )}
        </p>
      </div>

      {/* All dates modal */}
      {open && (
        <Modal isOpen onClose={() => setOpen(false)} title={`All Leave Dates — ${req.employeeName}`} size="sm">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">
              {total} day{total > 1 ? 's' : ''} of leave requested
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {req.dates.map((d, i) => (
                <div key={d} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600">{i + 1}</span>
                  <span className="text-sm text-gray-900 dark:text-white">{format(parseISO(d), 'dd MMM yyyy')}</span>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <button onClick={() => setOpen(false)} className="btn-secondary w-full justify-center text-sm">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminLeaveManagement() {
  const { userData: admin } = useAuth()
  const [tab,            setTab]           = useState('employee')
  const [leaveRequests,  setLeaveRequests]  = useState([])
  const [studentLeaves,  setStudentLeaves]  = useState([])
  const [employees,      setEmployees]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [approving,      setApproving]      = useState(null)
  const [rejectTarget,   setRejectTarget]   = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [lr, sl, emps] = await Promise.all([
        getLeaveRequests(),
        getStudentLeaves(),
        getEmployees(),
      ])
      setLeaveRequests(lr)
      setStudentLeaves(sl)
      setEmployees(emps)
    } catch (err) {
      toast.error(`Failed to load: ${err.message}`)
    } finally { setLoading(false) }
  }

  const handleApprove = async (req) => {
    setApproving(req.id)
    try {
      const adminName = admin?.adminName || admin?.name || 'Admin'
      const now = Timestamp.fromDate(new Date())

      // Build the list of leave dates
      let leaveDates = []
      if (req.dates?.length > 0) {
        // New format — explicit array of ISO date strings
        leaveDates = req.dates
      } else if (req.fromDate && req.toDate) {
        // Old format — date range; expand to individual days (skip Sundays)
        const days = eachDayOfInterval({
          start: parseISO(req.fromDate),
          end:   parseISO(req.toDate),
        })
        leaveDates = days
          .filter((d) => d.getDay() !== 0)           // skip Sundays
          .map((d) => format(d, 'yyyy-MM-dd'))
      }

      // Write an Absent attendance record for each leave date
      if (leaveDates.length > 0) {
        const records = leaveDates.map((dateStr) => ({
          employeeId:     req.employeeId,
          employeeName:   req.employeeName,
          designation:    req.designation || '',
          date:           Timestamp.fromDate(new Date(dateStr + 'T00:00:00')),
          dateStr,
          attendanceType: 'Absent',
          markedByLeave:  true,   // flag so it's traceable
        }))
        await saveEmployeeAttendance(records)
      }

      // Approve the leave request
      await updateLeaveRequest(req.id, {
        status:     'Approved',
        reviewedBy: adminName,
        reviewedAt: now,
      })

      toast.success(
        `Leave approved for ${req.employeeName}. ${leaveDates.length} day(s) marked Absent in attendance.`
      )
      loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally { setApproving(null) }
  }

  const pendingCount = leaveRequests.filter((r) => r.status === 'Pending').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employee leave requests and student leave notifications</p>
        </div>
        <button onClick={loadAll} className="btn-secondary text-sm"><HiRefresh className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('employee')}
          className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'employee' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          Employee Leave Requests
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">{pendingCount}</span>
          )}
        </button>
        <button onClick={() => setTab('student')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'student' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          Student Leave Notifications
        </button>
      </div>

      {/* ── Educator Leave Requests ── */}
      {tab === 'employee' && (
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          : leaveRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No leave requests yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="table-header">Employee</th>
                    <th className="table-header hidden sm:table-cell">Designation</th>
                    <th className="table-header">Dates</th>
                    <th className="table-header hidden md:table-cell">Reason</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {leaveRequests.map((req) => (
                    <tr key={req.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${req.status === 'Pending' ? 'bg-yellow-50/40 dark:bg-yellow-900/10' : ''}`}>
                      <td className="table-cell">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{req.employeeName}</p>
                        <p className="text-xs text-gray-400">{formatDate(req.submittedAt)}</p>
                      </td>
                      <td className="table-cell hidden sm:table-cell"><span className="badge-info">{req.designation}</span></td>
                      <td className="table-cell">
                        <DatesCell req={req} />
                      </td>
                      <td className="table-cell hidden md:table-cell text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{req.reason}</td>
                      <td className="table-cell">
                        <div className="space-y-1">
                          <StatusBadge status={req.status} />
                          {req.status === 'Rejected' && req.rejectionReason && (
                            <p className="text-xs text-red-400">{req.rejectionReason}</p>
                          )}
                          {req.status !== 'Pending' && req.reviewedBy && (
                            <p className="text-xs text-gray-400">By {req.reviewedBy}</p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        {req.status === 'Pending' && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleApprove(req)} disabled={approving === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">
                              {approving === req.id ? <LoadingSpinner size="sm" /> : 'Approve'}
                            </button>
                            <button onClick={() => setRejectTarget(req)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status !== 'Pending' && <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Student Leave Notifications ── */}
      {tab === 'student' && (
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
          : studentLeaves.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No student leave notifications yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="table-header">Student</th>
                    <th className="table-header">Class</th>
                    <th className="table-header">Leave Dates</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header hidden sm:table-cell">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {studentLeaves.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{l.studentName}</p>
                      </td>
                      <td className="table-cell text-sm text-gray-500">{l.className}</td>
                      <td className="table-cell">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{l.fromDate}</p>
                        <p className="text-xs text-gray-500">to {l.toDate}</p>
                      </td>
                      <td className="table-cell text-sm text-gray-600 dark:text-gray-400 max-w-xs">{l.reason}</td>
                      <td className="table-cell hidden sm:table-cell text-sm text-gray-400">{formatDate(l.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {rejectTarget && (
        <RejectDialog request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); loadAll() }} />
      )}
    </div>
  )
}
