import React, { useState, useEffect } from 'react'
import { HiPaperAirplane, HiPlus, HiInformationCircle, HiX, HiCalendar } from 'react-icons/hi'
import { useAuth } from '../../context/AuthContext'
import { addStudentLeave, getStudentLeaves, saveStudentAttendance } from '../../firebase/firestore'
import { formatDate } from '../../utils/helpers'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import { format, parseISO, isSameMonth, addMonths, subMonths, startOfMonth, getDay, getDaysInMonth } from 'date-fns'

// ─── Mini Multi-Select Calendar ───────────────────────────────────────────────
function MultiDateCalendar({ selectedDates, onChange }) {
  const [viewMonth, setViewMonth] = useState(new Date())

  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = getDay(startOfMonth(viewMonth))
  const daysInMonth = getDaysInMonth(viewMonth)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dateKey = (d) => format(d, 'yyyy-MM-dd')

  const toggleDay = (day) => {
    const d = new Date(year, month, day)
    if (d < today) return
    const key = dateKey(d)
    if (selectedDates.includes(key)) {
      onChange(selectedDates.filter((k) => k !== key))
    } else {
      onChange([...selectedDates, key].sort())
    }
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 select-none w-56">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button type="button" onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 text-sm leading-none">
          ‹
        </button>
        <span className="text-xs font-semibold text-gray-900 dark:text-white">
          {format(viewMonth, 'MMM yyyy')}
        </span>
        <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 text-sm leading-none">
          ›
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const d = new Date(year, month, day)
          const key = dateKey(d)
          const isPast = d < today
          const isSelected = selectedDates.includes(key)
          const isToday = key === dateKey(today)
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => toggleDay(day)}
              className={[
                'w-full aspect-square rounded text-xs font-medium transition-colors leading-none flex items-center justify-center',
                isPast ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'cursor-pointer',
                isSelected ? 'bg-primary-500 text-white' : '',
                !isSelected && isToday && !isPast ? 'border border-primary-400 text-primary-600' : '',
                !isSelected && !isPast ? 'hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-700 dark:text-gray-300' : '',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function StudentLeaveInfo() {
  const { userData } = useAuth()
  const [leaves,       setLeaves]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [selectedDates, setSelectedDates] = useState([])
  const [reason,       setReason]       = useState('')

  const uid = userData?.uid || userData?.id

  useEffect(() => { if (uid) load() }, [uid])

  const load = async () => {
    try {
      setLeaves(await getStudentLeaves(uid))
    } catch (err) {
      toast.error('Failed to load leave records')
    } finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedDates.length === 0) { toast.error('Please select at least one date'); return }
    if (!reason.trim())             { toast.error('Please enter a reason'); return }
    setSaving(true)
    try {
      await addStudentLeave({
        studentId:    uid,
        studentName:  userData?.studentName || '',
        className:    userData?.className   || '',
        dates:        selectedDates,
        totalDays:    selectedDates.length,
        reason:       reason.trim(),
        submittedAt:  Timestamp.fromDate(new Date()),
      })
      // Auto-mark attendance as Leave for each selected date
      const attendanceRecords = selectedDates.map((dateStr) => ({
        studentId:      uid,
        studentName:    userData?.studentName || '',
        className:      userData?.className   || '',
        date:           Timestamp.fromDate(new Date(dateStr + 'T00:00:00')),
        dateStr,
        attendanceType: 'Leave',
        markedBy:       'student_leave',
      }))
      await saveStudentAttendance(attendanceRecords)
      toast.success('Leave notification submitted! Attendance marked as Leave.')
      setSelectedDates([])
      setReason('')
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Submission failed')
    } finally { setSaving(false) }
  }

  const resetForm = () => { setSelectedDates([]); setReason(''); setShowForm(false) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Information</h1>
          <p className="text-sm text-gray-500 mt-0.5">Notify the school in advance about planned absence</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm">
          <HiPlus className="w-4 h-4" /> Notify Leave
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-start gap-3">
        <HiInformationCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          This is an <strong>advance leave notification</strong> — no approval is needed.
          Select the dates your child will be absent and submit.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 border-2 border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Submit Leave Notification</h2>
            <button type="button" onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <HiX className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Calendar */}
            <div>
              <label className="label flex items-center gap-2">
                <HiCalendar className="w-4 h-4" /> Select Leave Dates
              </label>
              <MultiDateCalendar selectedDates={selectedDates} onChange={setSelectedDates} />
            </div>

            {/* Selected dates summary */}
            {selectedDates.length > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                    Total Leave Days: {selectedDates.length}
                  </span>
                  <button type="button" onClick={() => setSelectedDates([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-200 rounded-full text-xs font-medium">
                      {format(parseISO(d), 'dd MMM')}
                      <button type="button" onClick={() => setSelectedDates(selectedDates.filter((x) => x !== d))}>
                        <HiX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="label">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field resize-none" rows={3}
                placeholder="e.g. Family function, Medical appointment…"
                required
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={resetForm} disabled={saving} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving || selectedDates.length === 0} className="btn-primary">
                {saving ? <><LoadingSpinner size="sm" /> Submitting…</> : <><HiPaperAirplane className="w-4 h-4" /> Submit</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Submitted Leave Notifications</h2>
        </div>
        {loading ? (
          <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>
        ) : leaves.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No leave notifications yet</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {leaves.map((l) => (
              <div key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* New format: dates array */}
                    {l.dates?.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {l.totalDays} day{l.totalDays > 1 ? 's' : ''} leave
                          </span>
                          <span className="badge-info">{l.totalDays}d</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {l.dates.map((d) => (
                            <span key={d} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                              {format(parseISO(d), 'dd MMM yyyy')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Legacy format: fromDate → toDate */
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {l.fromDate} → {l.toDate}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{l.reason}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(l.submittedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
