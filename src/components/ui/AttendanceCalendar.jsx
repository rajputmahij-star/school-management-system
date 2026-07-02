import React, { useMemo, memo } from 'react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isFuture, isToday,
} from 'date-fns'

// Week starts Monday. Mo=0 … Su=6
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const toMon = (d) => (d === 0 ? 6 : d - 1)

// Full-cell background + text colors per status
const CELL_STYLE = {
  Present:    'bg-green-500  text-white',
  Absent:     'bg-red-500    text-white',
  'Half Day': 'bg-yellow-400 text-white',
  Leave:      'bg-blue-500   text-white',
}

// Student version — Present / Absent / Leave shown
const CELL_STYLE_STUDENT = {
  Present: 'bg-green-500 text-white',
  Absent:  'bg-red-500   text-white',
  Leave:   'bg-blue-500  text-white',
}

const LEGEND_FULL = [
  { label: 'Present',  cls: 'bg-green-500' },
  { label: 'Absent',   cls: 'bg-red-500' },
  { label: 'Half Day', cls: 'bg-yellow-400' },
  { label: 'Leave',    cls: 'bg-blue-500' },
  { label: 'No Record',cls: 'bg-gray-200 dark:bg-gray-700' },
]

const LEGEND_STUDENT = [
  { label: 'Present',  cls: 'bg-green-500' },
  { label: 'Absent',   cls: 'bg-red-500' },
  { label: 'Leave',    cls: 'bg-blue-500' },
  { label: 'No Record',cls: 'bg-gray-200 dark:bg-gray-700' },
]

/**
 * Compact HRMS-style attendance calendar.
 * Props:
 *   records      – [{ dateStr: 'yyyy-MM-dd', attendanceType }]
 *   month        – Date
 *   onPrevMonth  – fn
 *   onNextMonth  – fn
 *   studentMode  – bool (default false) — hides Half Day & Leave
 */
const AttendanceCalendar = memo(function AttendanceCalendar({
  records = [], month, onPrevMonth, onNextMonth, studentMode = false,
}) {
  const cellStyles = studentMode ? CELL_STYLE_STUDENT : CELL_STYLE
  const legend     = studentMode ? LEGEND_STUDENT     : LEGEND_FULL
  // dateStr → attendanceType
  const map = useMemo(() => {
    const m = {}
    records.forEach((r) => { if (r?.dateStr) m[r.dateStr] = r.attendanceType })
    return m
  }, [records])

  const days = useMemo(() =>
    eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  )

  const lead = toMon(getDay(startOfMonth(month)))

  const summary = useMemo(() => {
    const c = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0 }
    Object.values(map).forEach((t) => { if (t in c) c[t]++ })
    const eff   = c.Present + c['Half Day'] * 0.5
    const total = c.Present + c.Absent + c['Half Day'] + c.Leave
    return { ...c, pct: total > 0 ? Math.round((eff / total) * 100) : 0 }
  }, [map])

  return (
    <div className="card p-2 sm:p-3 select-none w-full max-w-xs mx-auto sm:max-w-sm">

      {/* ── Month navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrevMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-base font-bold transition-colors">
          ‹
        </button>
        <span className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">
          {format(month, 'MMMM yyyy')}
        </span>
        <button onClick={onNextMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-base font-bold transition-colors">
          ›
        </button>
      </div>

      {/* ── Day-of-week headers ──────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_LABELS.map((d) => (
          <div key={d}
            className="text-center text-[8px] font-semibold text-gray-400 dark:text-gray-500 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* ── Day cells ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px">
        {/* Leading blank cells */}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}

        {/* Actual day cells */}
        {days.map((day) => {
          const ds     = format(day, 'yyyy-MM-dd')
          const type   = map[ds]
          const future = isFuture(day) && !isToday(day)
          const style  = cellStyles[type]

          return (
            <div
              key={ds}
              title={type || (future ? 'Future' : 'No record')}
              className={`
                aspect-square rounded-sm flex items-center justify-center
                text-[8px] font-semibold transition-all
                ${style
                  ? style
                  : future
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }
                ${isToday(day) && !style
                  ? 'ring-1 ring-primary-500 ring-offset-1 dark:ring-offset-gray-900'
                  : ''
                }
              `}
            >
              {format(day, 'd')}
            </div>
          )
        })}
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────── */}
      <div className={`grid gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-center ${studentMode ? 'grid-cols-4' : 'grid-cols-5'}`}>
        {[
          { label: 'Present',  v: summary.Present,     c: 'text-green-600 dark:text-green-400' },
          { label: 'Absent',   v: summary.Absent,      c: 'text-red-500' },
          ...(!studentMode ? [
            { label: 'Half',   v: summary['Half Day'], c: 'text-yellow-500' },
          ] : []),
          { label: 'Leave',    v: summary.Leave,       c: 'text-blue-500' },
          { label: '%',        v: `${summary.pct}%`,   c: summary.pct >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-500' },
        ].map(({ label, v, c }) => (
          <div key={label}>
            <p className={`text-[10px] font-bold ${c}`}>{v}</p>
            <p className="text-[8px] text-gray-400 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800">
        {legend.map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-0.5">
            <div className={`w-2 h-2 rounded-sm ${cls}`} />
            <span className="text-[8px] text-gray-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

export default AttendanceCalendar
