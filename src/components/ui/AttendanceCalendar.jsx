import React, { useMemo, memo, useState } from 'react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isFuture, isToday,
} from 'date-fns'
import { ATTENDANCE_STATUSES, STATUS_MAP, normalizeStatus, calcAttendanceSummary } from '../../utils/attendanceConfig'

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const toMon = (d) => (d === 0 ? 6 : d - 1)

const LEGEND = ATTENDANCE_STATUSES.map((s) => ({ label: s.label, short: s.short, cls: s.color }))
LEGEND.push({ label: 'No Record', short: '-', cls: 'bg-gray-200 dark:bg-gray-700' })

/**
 * AttendanceCalendar
 * Props:
 *   records     – [{ dateStr: 'yyyy-MM-dd', attendanceType, remarks? }]
 *   month       – Date
 *   onPrevMonth – fn
 *   onNextMonth – fn
 *   compact     – bool (default false) — smaller version without details popup
 */
const AttendanceCalendar = memo(function AttendanceCalendar({
  records = [], month, onPrevMonth, onNextMonth, compact = false,
}) {
  const [selected, setSelected] = useState(null) // { dateStr, type, remarks }

  // dateStr → { code, remarks }
  const map = useMemo(() => {
    const m = {}
    records.forEach((r) => {
      if (r?.dateStr) {
        m[r.dateStr] = {
          code:    normalizeStatus(r.attendanceType),
          remarks: r.remarks || '',
        }
      }
    })
    return m
  }, [records])

  const days = useMemo(() =>
    eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  )

  const lead = toMon(getDay(startOfMonth(month)))

  const summary = useMemo(() => calcAttendanceSummary(records), [records])

  return (
    <div className="card p-2 sm:p-3 select-none w-full max-w-xs mx-auto sm:max-w-sm">

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrevMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-base font-bold transition-colors">‹</button>
        <span className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">
          {format(month, 'MMMM yyyy')}
        </span>
        <button onClick={onNextMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-base font-bold transition-colors">›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[8px] font-semibold text-gray-400 dark:text-gray-500 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: lead }).map((_, i) => <div key={`b-${i}`} className="aspect-square" />)}
        {days.map((day) => {
          const ds     = format(day, 'yyyy-MM-dd')
          const entry  = map[ds]
          const code   = entry?.code
          const status = code ? STATUS_MAP[code] : null
          const future = isFuture(day) && !isToday(day)

          return (
            <button
              key={ds}
              title={status ? `${status.label}${entry.remarks ? ': ' + entry.remarks : ''}` : (future ? 'Future' : 'No record')}
              onClick={() => !future && entry && setSelected({ ds, status, remarks: entry.remarks })}
              className={`aspect-square rounded-sm flex items-center justify-center text-[8px] font-semibold transition-all
                ${status
                  ? `${status.color} ${status.text} ${!future && !compact ? 'hover:opacity-80 cursor-pointer' : ''}`
                  : future
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }
                ${isToday(day) && !status ? 'ring-1 ring-primary-500 ring-offset-1 dark:ring-offset-gray-900' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-center">
        {[
          { label: 'P',   v: summary.P,    c: 'text-green-600 dark:text-green-400' },
          { label: 'A',   v: summary.A,    c: 'text-red-500' },
          { label: 'LP',  v: summary.LP,   c: 'text-purple-500' },
          { label: '%',   v: `${summary.pct}%`, c: summary.pct >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-500' },
        ].map(({ label, v, c }) => (
          <div key={label}>
            <p className={`text-[10px] font-bold ${c}`}>{v}</p>
            <p className="text-[8px] text-gray-400 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 mt-0.5 text-center">
        {[
          { label: 'HDF', v: summary.HDF, c: 'text-orange-500' },
          { label: 'HDS', v: summary.HDS, c: 'text-amber-500' },
          { label: 'L',   v: summary.L,   c: 'text-blue-500' },
          { label: 'H',   v: summary.H,   c: 'text-gray-400' },
        ].map(({ label, v, c }) => (
          <div key={label}>
            <p className={`text-[10px] font-bold ${c}`}>{v}</p>
            <p className="text-[8px] text-gray-400 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
        {LEGEND.map(({ label, short, cls }) => (
          <div key={short} className="flex items-center gap-0.5">
            <div className={`w-2 h-2 rounded-sm ${cls}`} />
            <span className="text-[8px] text-gray-500 dark:text-gray-400">{short} = {label}</span>
          </div>
        ))}
      </div>

      {/* Click-on-date popup */}
      {selected && (
        <div className="mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${selected.status?.color}`} />
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{selected.ds}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{selected.status?.label || 'No record'}</p>
          {selected.remarks && <p className="text-xs text-gray-500 italic mt-0.5">"{selected.remarks}"</p>}
        </div>
      )}
    </div>
  )
})

export default AttendanceCalendar
