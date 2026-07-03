import { differenceInYears, differenceInDays, format, isValid, parseISO } from 'date-fns'

// ─── Date Utilities ───────────────────────────────────────────────────────────

export const calculateAge = (dob) => {
  if (!dob) return 'N/A'
  const birthDate = dob?.toDate ? dob.toDate() : new Date(dob)
  if (!isValid(birthDate)) return 'N/A'
  return differenceInYears(new Date(), birthDate)
}

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return 'N/A'
  const d = date?.toDate ? date.toDate() : new Date(date)
  if (!isValid(d)) return 'N/A'
  return format(d, fmt)
}

export const formatCurrency = (amount) => {
  if (amount == null) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(Number(amount) || 0))
}

export const toDateString = (date) => {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return format(d, 'yyyy-MM-dd')
}

// ─── School Classes ───────────────────────────────────────────────────────────
export const SCHOOL_CLASSES = [
  'Pre-Primary',
  'Primary-I',
  'Primary-II',
  'Secondary-A',
  'Secondary-B',
  'Pre-Vocational',
  'NIOS Group',
]

// NIOS Group sub-options
export const NIOS_SUBGROUPS = ['OBE-A', 'OBE-B', 'OBE-C', 'Secondary', 'Sr.Secondary']

/** Returns true if the given class name is NIOS Group */
export const isNiosGroup = (className) => className === 'NIOS Group'

// ─── Default form options (used as fallback when not customised in Settings) ──
export const DEFAULT_FORM_OPTIONS = {
  classes:          [...SCHOOL_CLASSES],
  niosSubGroups:    [...NIOS_SUBGROUPS],
  genders:          ['Male', 'Female', 'Other'],
  transportOptions: [
    'School Bus', 'Van', 'Auto Rickshaw', 'Bicycle',
    'Walking', 'Parent Drop/Pickup', 'Private Vehicle', 'Other',
  ],
  designations: [
    'Principal', 'Co-ordinator', 'Special Educator', 'Educator',
    'Assistant Educator', 'Helper', 'Office Assistant', 'Intern', 'Driver', 'Guard',
  ],
}

// ─── Late Fee Calculator ──────────────────────────────────────────────────────
/**
 * Payment window: 5th–10th of every month → no fine.
 * From 11th onward (1st overdue day) → ₹250 base.
 * Each additional overdue day → +₹25.
 *
 * Formula: fine = 250 + ((daysLate - 1) × 25)
 * Examples:
 *   1 day late (11th) → 250 + 0  = ₹250
 *   2 days late       → 250 + 25 = ₹275
 *   5 days late       → 250 + 100= ₹350
 *
 * Due date = 10th of current month (last day of payment window).
 */
export const calculateLateFee = (dueDateInput) => {
  // dueDateInput is ignored for the new rule — due date is always 10th of current month
  const today = new Date()
  const dueDate = new Date(today.getFullYear(), today.getMonth(), 10) // 10th of month
  dueDate.setHours(23, 59, 59, 999)

  const daysLate = differenceInDays(today, dueDate)

  if (daysLate <= 0) return { daysLate: 0, fine: 0 }

  const fine = 250 + ((daysLate - 1) * 25)
  return { daysLate, fine }
}

// ─── Working Days Calculator (excludes Sundays) ──────────────────────────────

/**
 * Count Mon–Sat days in a given month/year. Sundays are excluded.
 */
export const getWorkingDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate() // month is 1-indexed
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay() // 0=Sun
    if (day !== 0) count++
  }
  return count
}

/**
 * Calculate salary earned based on attendance, excluding Sundays.
 * presentDays and halfDays refer to Mon–Sat days only.
 */
export const calculateSalaryFromAttendance = (monthlySalary, month, year, presentDays, halfDays = 0) => {
  const workingDays = getWorkingDaysInMonth(month, year)
  if (!monthlySalary || workingDays === 0) return { workingDays, perDaySalary: 0, salaryEarned: 0, attendancePct: 0 }
  const effective = presentDays + halfDays * 0.5
  const perDaySalary = monthlySalary / workingDays
  const salaryEarned = Math.round(perDaySalary * effective)
  const attendancePct = Math.round((effective / workingDays) * 100)
  return {
    workingDays,
    perDaySalary: Math.round(perDaySalary * 100) / 100,
    salaryEarned:  salaryEarned,
    attendancePct,
  }
}

// ─── Salary Calculation (new formula) ────────────────────────────────────────

/**
 * Get actual days in a month (real calendar, handles leap years).
 * month is 1-indexed (1 = January)
 */
export const getMonthDays = (month, year) => new Date(year, month, 0).getDate()

/**
 * Full salary calculation — exact business rules:
 *
 *   Step 1: Salary Earned         = round( (monthlySalary × presentDays) / monthDays )
 *   Step 2: Deduction (5%)        = round( salaryEarned × 5% )
 *   Step 3: Salary After Deduction= salaryEarned - deduction
 *   Step 4: SMC Tax               = 200 if ORIGINAL monthlySalary > 9000, else 0
 *              ↑ NOTE: checks monthlySalary, NOT salaryEarned
 *   Step 5: Net Salary            = salaryAfterDeduction - smcTax
 *
 * All values rounded to nearest rupee (Math.round).
 *
 * Example:
 *   monthlySalary=12000, presentDays=23, monthDays=28
 *   salaryEarned         = round(12000×23/28) = round(9857.14) = 9857
 *   deduction            = round(9857×0.05)   = round(492.85)  = 493
 *   salaryAfterDeduction = 9857 - 493         = 9364
 *   smcTax               = 200  (12000 > 9000)
 *   netSalary            = 9364 - 200         = 9164
 */
export const computeNetSalary = (monthlySalary, presentDays, month, year) => {
  const monthDays            = getMonthDays(month, year)
  const salary               = Number(monthlySalary) || 0
  const present              = Number(presentDays)   || 0

  const salaryEarned         = monthDays > 0
    ? Math.round((salary * present) / monthDays)
    : 0

  const deduction            = Math.round(salaryEarned * 0.05)
  const salaryAfterDeduction = salaryEarned - deduction

  // SMC Tax checks ORIGINAL monthly salary — NOT salary earned
  const smcTax               = salary > 9000 ? 200 : 0

  const netSalary            = salaryAfterDeduction - smcTax

  return {
    monthDays,
    salaryEarned,
    deduction,
    salaryAfterDeduction,
    smcTax,
    netSalary,
  }
}

/**
 * Convert a number to words (Indian format, for salary slip)
 */
export const numberToWords = (num) => {
  if (!num || num === 0) return 'Zero Rupees Only'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const convert = (n) => {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + convert(n%100) : '')
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '')
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '')
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + convert(n%10000000) : '')
  }
  const rupees = Math.floor(num)
  const paise  = Math.round((num - rupees) * 100)
  let words = convert(rupees) + ' Rupees'
  if (paise > 0) words += ' and ' + convert(paise) + ' Paise'
  return words + ' Only'
}

// ─── Attendance Calculator ────────────────────────────────────────────────────

export const calculateAttendancePercent = (presentDays, totalSchoolDays) => {
  if (!totalSchoolDays || totalSchoolDays === 0) return 0
  return Math.round((presentDays / totalSchoolDays) * 100)
}

// ─── ID Generators ────────────────────────────────────────────────────────────

export const generateStudentId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `STU${year}${random}`
}

export const generateEmployeeId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(100 + Math.random() * 900)
  return `EMP${year}${random}`
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

export const getStudentStatus = (leaveDate) => {
  if (!leaveDate) return 'Ongoing'
  const leave = leaveDate?.toDate ? leaveDate.toDate() : new Date(leaveDate)
  return isValid(leave) ? formatDate(leave) : 'Ongoing'
}

export const cn = (...classes) => classes.filter(Boolean).join(' ')

// ─── Fee Rule Engine ──────────────────────────────────────────────────────────

/**
 * Get the fee start date for a student.
 * Uses caseHistoryDate if present, otherwise falls back to admissionDate.
 */
/**
 * Get the fee start date for a student.
 * Uses caseHistoryDate if present, otherwise falls back to admissionDate.
 */
export const getFeeStartDate = (student) => student?.caseHistoryDate || student?.admissionDate || null

/**
 * Derive the academic year string for a given admission date.
 * Academic year runs April → March, e.g. admission in Aug 2024 → '2024-2025'
 */
export const getAcademicYear = (admissionDate) => {
  if (!admissionDate) return null
  const d = admissionDate?.toDate ? admissionDate.toDate() : new Date(admissionDate)
  if (!isValid(d)) return null
  const month = d.getMonth() // 0-indexed
  const year  = d.getFullYear()
  // If admission is Jan-Mar, academic year started in previous calendar year
  const startYear = month < 3 ? year - 1 : year
  return `${startYear}-${String(startYear + 1).slice(-4)}`
}

/**
 * Given a list of fee rule documents and a student, return the calculated fee.
 * feeRules: [{ academicYear, brackets: [{minAge, maxAge, fee}] }]
 * student:  { dob, admissionDate }
 */
export const calculateStudentFee = (feeRules, student) => {
  const year = getAcademicYear(student.admissionDate)
  if (!year) return { fee: 0, academicYear: null, bracket: null }

  const rule = feeRules.find((r) => r.academicYear === year)
  if (!rule) return { fee: 0, academicYear: year, bracket: null }

  const age = calculateAge(student.dob)
  if (age === 'N/A') return { fee: 0, academicYear: year, bracket: null }

  const bracket = rule.brackets.find(
    (b) => age >= Number(b.minAge) && (b.maxAge === '' || age <= Number(b.maxAge))
  )
  if (!bracket) return { fee: 0, academicYear: year, bracket: null }

  return { fee: Number(bracket.fee), academicYear: year, bracket }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginate = (items, page, perPage = 10) => {
  const start = (page - 1) * perPage
  const end = start + perPage
  return {
    data: items.slice(start, end),
    total: items.length,
    totalPages: Math.ceil(items.length / perPage),
    currentPage: page,
  }
}
