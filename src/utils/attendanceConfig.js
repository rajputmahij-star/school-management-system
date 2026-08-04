/**
 * Centralized attendance configuration
 * Used across student and employee attendance pages
 */

// ─── Status definitions ──────────────────────────────────────────────────────
export const ATTENDANCE_STATUSES = [
  { code: 'P',   label: 'Present',               short: 'P',   color: 'bg-green-500',   text: 'text-white',        badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',  weight: 1   },
  { code: 'A',   label: 'Absent',                short: 'A',   color: 'bg-red-500',     text: 'text-white',        badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',          weight: 0   },
  { code: 'L',   label: 'Leave',                 short: 'L',   color: 'bg-blue-500',    text: 'text-white',        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',      weight: 0,  isLeave: true },
  { code: 'HDF', label: 'Half Day (First Half)', short: 'HDF', color: 'bg-orange-400',  text: 'text-white',        badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', weight: 0.5 },
  { code: 'HDS', label: 'Half Day (Second Half)',short: 'HDS', color: 'bg-amber-500',   text: 'text-white',        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',   weight: 0.5 },
  { code: 'LP',  label: 'Late Present',          short: 'LP',  color: 'bg-purple-500',  text: 'text-white',        badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', weight: 1   },
  { code: 'H',   label: 'Holiday',               short: 'H',   color: 'bg-gray-400',    text: 'text-white',        badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',          weight: null, isHoliday: true },
]

// Quick lookup by code
export const STATUS_MAP = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s.code, s]))

// Legacy string → code mapping (for backward compatibility with old 'Present'/'Absent' etc)
export const LEGACY_MAP = {
  'Present':    'P',
  'Absent':     'A',
  'Leave':      'L',
  'Half Day':   'HDF',
  'HalfDay':    'HDF',
  'Half Day (First Half)':  'HDF',
  'Half Day (Second Half)': 'HDS',
  'Late Present': 'LP',
  'Holiday':    'H',
}

// Normalize any stored value to a code
export const normalizeStatus = (val) => {
  if (!val) return 'P'
  if (STATUS_MAP[val]) return val         // already a code
  return LEGACY_MAP[val] || 'P'           // legacy string → code
}

/**
 * Calculate attendance summary from an array of status codes
 * Returns { P, A, L, HDF, HDS, LP, H, workingDays, effectiveDays, pct }
 * Holiday does NOT count as working day
 */
export const calcAttendanceSummary = (records) => {
  const counts = { P: 0, A: 0, L: 0, HDF: 0, HDS: 0, LP: 0, H: 0 }
  records.forEach((r) => {
    const code = normalizeStatus(r.attendanceType)
    if (code in counts) counts[code]++
  })

  const workingDays    = counts.P + counts.A + counts.L + counts.HDF + counts.HDS + counts.LP
  const effectiveDays  = counts.P + counts.LP + (counts.HDF + counts.HDS) * 0.5
  const pct            = workingDays > 0 ? Math.round((effectiveDays / workingDays) * 100) : 0

  return { ...counts, workingDays, effectiveDays, pct }
}
