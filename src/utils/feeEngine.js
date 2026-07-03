/**
 * feeEngine.js
 * Pure, stateless fee calculation utilities.
 * No Firebase imports — only date-fns and plain JS.
 */
import {
  differenceInDays,
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  addQuarters,
  addYears,
  isBefore,
  isAfter,
  parseISO,
  isValid,
} from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────
export const BILLING_TYPES = ['Monthly', 'Quarterly', 'Yearly']

// Default due-day fallbacks (overridden by settings)
export const DEFAULT_MONTHLY_DUE_DAY   = 5
export const DEFAULT_QUARTERLY_DUE_DAY = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely convert Firestore Timestamp | Date | string → JS Date */
export const toJsDate = (v) => {
  if (!v) return null
  if (v?.toDate) return v.toDate()
  const d = new Date(v)
  return isValid(d) ? d : null
}

/**
 * Build the due date for a period.
 * @param {number} year       - calendar year of the period start
 * @param {number} month      - 0-indexed month of the period start
 * @param {number} dueDay     - day-of-month for due date (1–28)
 */
export const buildDueDate = (year, month, dueDay) =>
  new Date(year, month, Math.min(dueDay, 28))

/**
 * Calculate late fee for a single fee record.
 * lateFeeBase   - ₹250 (first overdue day)
 * lateFeePerDay - ₹25  (each additional day)
 * Returns { daysLate, fine } based on today vs dueDate.
 * Returns { 0, 0 } if dueDate is in the future or today.
 */
export const calcLateFee = (dueDate, lateFeeBase = 250, lateFeePerDay = 25) => {
  if (!dueDate) return { daysLate: 0, fine: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due   = new Date(dueDate)
  due.setHours(23, 59, 59, 999)
  const days = differenceInDays(today, due)
  if (days <= 0) return { daysLate: 0, fine: 0 }
  const fine = lateFeeBase + (days - 1) * lateFeePerDay
  return { daysLate: days, fine }
}

// ─── Period key builders ──────────────────────────────────────────────────────

/** 'monthly'   → 'YYYY-MM'  e.g. '2026-04' */
export const monthlyPeriodKey = (year, month0) =>
  `${year}-${String(month0 + 1).padStart(2, '0')}`

/** 'quarterly' → 'YYYY-Q1'  e.g. '2026-Q1' */
export const quarterlyPeriodKey = (year, quarterIndex) =>
  `${year}-Q${quarterIndex + 1}`

/** 'yearly'    → 'YYYY-YYYY' e.g. '2025-2026' */
export const yearlyPeriodKey = (startYear) =>
  `${startYear}-${startYear + 1}`

/** Human-readable period label */
export const periodLabel = (periodKey, billingType) => {
  if (billingType === 'Monthly') {
    // 'YYYY-MM' → 'April 2026'
    const [y, m] = periodKey.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return format(d, 'MMMM yyyy')
  }
  if (billingType === 'Quarterly') {
    // 'YYYY-Q1' → 'Apr – Jun 2026'
    const [y, q] = periodKey.split('-Q')
    const qIdx   = Number(q) - 1
    const months = QUARTER_MONTHS[qIdx]
    const startM = new Date(Number(y), months[0], 1)
    const endM   = new Date(Number(y), months[months.length - 1], 1)
    return `${format(startM, 'MMM')} – ${format(endM, 'MMM yyyy')}`
  }
  // Yearly: '2025-2026'
  return `AY ${periodKey}`
}

// ─── Quarterly helpers ────────────────────────────────────────────────────────
// Indian academic year: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
export const QUARTER_MONTHS = [
  [3, 4, 5],   // Q1: Apr May Jun  (0-indexed months)
  [6, 7, 8],   // Q2: Jul Aug Sep
  [9, 10, 11], // Q3: Oct Nov Dec
  [0, 1, 2],   // Q4: Jan Feb Mar  (next calendar year)
]

/** Return quarter index (0–3) for a given 0-indexed month */
export const getQuarterIndex = (month0) => {
  if (month0 >= 3 && month0 <= 5) return 0
  if (month0 >= 6 && month0 <= 8) return 1
  if (month0 >= 9 && month0 <= 11) return 2
  return 3 // Jan, Feb, Mar
}

// ─── Pro-rata fee calculator ─────────────────────────────────────────────────

/**
 * Apply pro-rata fee to the first period if the start date is not the 1st of the month.
 *
 * Formula: firstMonthFee = ceil(remainingDays / totalDaysInMonth * monthlyBaseFee)
 * where remainingDays = totalDaysInMonth - startDay + 1
 *
 * @param {Array}  periods   - output of generateMonthlyPeriods or the inline period array
 * @param {Date}   startDate - the actual case history / admission date (JS Date)
 * @param {number} monthlyBaseFee - full monthly fee
 * @returns {Array} periods with first period's baseFee adjusted if needed
 */
export const applyProRata = (periods, startDate, monthlyBaseFee) => {
  if (!periods.length || !startDate) return periods
  const day = startDate.getDate()
  if (day === 1) return periods  // starts on 1st — no pro-rata needed

  return periods.map((p, idx) => {
    if (idx !== 0) return p
    const [y, mo] = p.periodKey.split('-').map(Number)
    const totalDays = new Date(y, mo, 0).getDate()  // days in that month
    const remaining = totalDays - day + 1
    const proRataFee = Math.ceil((remaining / totalDays) * monthlyBaseFee)
    return { ...p, baseFee: proRataFee, isProRata: true }
  })
}

// ─── Period generators ────────────────────────────────────────────────────────

/**
 * Generate monthly period records from admissionDate up to today (inclusive).
 * Each record: { periodKey, label, dueDate, baseFee }
 * The first period is automatically pro-rated if start day > 1.
 */
export const generateMonthlyPeriods = (admissionDate, baseFee, dueDayOverride, defaultDueDay) => {
  const dueDay = dueDayOverride || defaultDueDay || DEFAULT_MONTHLY_DUE_DAY
  const start  = toJsDate(admissionDate)
  if (!start) return []
  const today = new Date()

  const periods = []
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)

  while (!isAfter(cursor, new Date(today.getFullYear(), today.getMonth(), 1))) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const key     = monthlyPeriodKey(y, m)
    const dueDate = buildDueDate(y, m, dueDay)
    periods.push({
      periodKey: key,
      label:     periodLabel(key, 'Monthly'),
      dueDate,
      baseFee,
      billingType: 'Monthly',
    })
    cursor = addMonths(cursor, 1)
  }

  // Apply pro-rata to the first period if start day > 1
  return applyProRata(periods, start, baseFee)
}

/**
 * Generate quarterly period records from admissionDate up to today.
 */
export const generateQuarterlyPeriods = (admissionDate, baseFee, dueDayOverride, defaultDueDay) => {
  const dueDay = dueDayOverride || defaultDueDay || DEFAULT_QUARTERLY_DUE_DAY
  const start  = toJsDate(admissionDate)
  if (!start) return []
  const today = new Date()

  const periods = []
  // Find which quarter the student started in
  const startQ = getQuarterIndex(start.getMonth())

  // Determine start calendar year for Q
  let cursorYear  = start.getFullYear()
  let cursorQIdx  = startQ

  // Adjust for Q4 (Jan-Mar): these belong to next academic year block
  // We just iterate by moving quarter-by-quarter
  const maxIter = 40 // safety
  for (let i = 0; i < maxIter; i++) {
    const qMonths    = QUARTER_MONTHS[cursorQIdx]
    // For Q4 (months 0,1,2) the calendar year of Jan-Mar is one ahead
    const calYear    = cursorQIdx === 3 ? cursorYear + 1 : cursorYear
    const firstMonth = qMonths[0]
    const periodStart = new Date(calYear, firstMonth, 1)

    if (isAfter(periodStart, today)) break

    const dueDateCalYear = cursorQIdx === 3 ? cursorYear + 1 : cursorYear
    const dueDate = buildDueDate(dueDateCalYear, firstMonth, dueDay)

    // The key year is the academic-year start
    const keyYear  = cursorQIdx === 3 ? cursorYear : cursorYear
    const key      = `${keyYear}-Q${cursorQIdx + 1}`

    const quarterlyFee = baseFee * 3

    periods.push({
      periodKey:   key,
      label:       periodLabel(key, 'Quarterly'),
      dueDate,
      baseFee:     quarterlyFee,
      billingType: 'Quarterly',
    })

    // advance to next quarter
    cursorQIdx++
    if (cursorQIdx > 3) { cursorQIdx = 0; cursorYear++ }
  }
  return periods
}

/**
 * Generate yearly period records.
 * Each period covers one academic year (Apr → Mar).
 * No fixed due date — just track "paid until" via payments.
 */
export const generateYearlyPeriods = (admissionDate, baseFee) => {
  const start = toJsDate(admissionDate)
  if (!start) return []
  const today = new Date()

  const periods = []
  // Academic year start = April
  let startYear = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1

  for (let i = 0; i < 10; i++) {
    const acYearStart = new Date(startYear + i, 3, 1)  // April
    const acYearEnd   = new Date(startYear + i + 1, 2, 31) // March next year
    if (isAfter(acYearStart, today)) break

    const key = yearlyPeriodKey(startYear + i)
    periods.push({
      periodKey:   key,
      label:       periodLabel(key, 'Yearly'),
      dueDate:     null, // no fixed due date for yearly
      baseFee:     baseFee * 11, // 11 months (1 free)
      billingType: 'Yearly',
      periodEnd:   acYearEnd,
    })
  }
  return periods
}

/**
 * Master generator — dispatches to the right generator.
 */
export const generatePeriods = (billingType, admissionDate, baseFee, dueDayOverride, settings) => {
  const defMonthly   = settings?.defaultMonthlyDueDay   || DEFAULT_MONTHLY_DUE_DAY
  const defQuarterly = settings?.defaultQuarterlyDueDay || DEFAULT_QUARTERLY_DUE_DAY
  if (billingType === 'Monthly')   return generateMonthlyPeriods(admissionDate, baseFee, dueDayOverride, defMonthly)
  if (billingType === 'Quarterly') return generateQuarterlyPeriods(admissionDate, baseFee, dueDayOverride, defQuarterly)
  if (billingType === 'Yearly')    return generateYearlyPeriods(admissionDate, baseFee)
  return []
}

/**
 * Merge generated periods with existing ledger records from Firestore.
 * Returns enriched array ready for UI.
 * ledgerMap: { [periodKey]: { status, paidAt, razorpayId, amountPaid } }
 */
export const mergeLedger = (periods, ledgerMap, lateFeeBase, lateFeePerDay) => {
  return periods.map((p) => {
    const record  = ledgerMap[p.periodKey] || {}
    const isPaid  = record.status === 'Paid'
    // If admin waived the fine, honour that — fine = 0
    const hasWaiver = record.waivedFine > 0
    const { daysLate, fine } = (isPaid || hasWaiver)
      ? { daysLate: 0, fine: 0 }
      : calcLateFee(p.dueDate, lateFeeBase, lateFeePerDay)
    return {
      ...p,
      status:     record.status || 'Pending',
      paidAt:     record.paidAt || null,
      amountPaid: record.amountPaid || 0,
      fine,
      daysLate,
      waivedFine: record.waivedFine || 0,
      totalPayable: p.baseFee + fine,
      ledgerId:   record.id || null,
    }
  })
}
