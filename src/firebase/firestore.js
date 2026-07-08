import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './config'

// ─── Generic CRUD ────────────────────────────────────────────────────────────

export const addDocument = async (collectionName, data) => {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const setDocument = async (collectionName, docId, data) => {
  // merge: true = upsert (creates if not exists, updates if exists)
  // This means only one write operation is needed regardless of whether the doc exists
  await setDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export const updateDocument = async (collectionName, docId, data) => {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export const deleteDocument = async (collectionName, docId) => {
  await deleteDoc(doc(db, collectionName, docId))
}

export const getDocument = async (collectionName, docId) => {
  const snap = await getDoc(doc(db, collectionName, docId))
  if (snap.exists()) return { id: snap.id, ...snap.data() }
  return null
}

export const getCollection = async (collectionName, constraints = []) => {
  const q = query(collection(db, collectionName), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── Students ────────────────────────────────────────────────────────────────

// ─── Students ── with in-memory cache to reduce Firestore reads ──────────────
let _studentsCache = null
let _studentsCacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

export const getStudents = async (forceRefresh = false) => {
  const now = Date.now()
  if (!forceRefresh && _studentsCache && (now - _studentsCacheTime) < CACHE_TTL) {
    return _studentsCache
  }
  // Try with orderBy first, fall back to unordered if index missing
  let students
  try {
    students = await getCollection('students', [orderBy('createdAt', 'desc')])
  } catch (err) {
    // Index not ready or createdAt missing — fetch without ordering and sort client-side
    console.warn('getStudents: orderBy failed, fetching unordered:', err.message)
    students = await getCollection('students', [])
    students.sort((a, b) => {
      const aT = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
      const bT = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
      return bT - aT
    })
  }
  _studentsCache = students
  _studentsCacheTime = now
  return students
}

export const invalidateStudentsCache = () => { _studentsCache = null }

export const getStudentById = async (id) => {
  return getDocument('students', id)
}

export const addStudent = async (data) => {
  invalidateStudentsCache()
  return addDocument('students', { ...data, status: 'active' })
}

export const updateStudent = async (id, data) => {
  invalidateStudentsCache()
  return updateDocument('students', id, data)
}

export const deleteStudent = async (id) => {
  invalidateStudentsCache()
  return deleteDocument('students', id)
}

// ─── Employees ───────────────────────────────────────────────────────────────

export const getEmployees = async () => {
  return getCollection('employees', [orderBy('createdAt', 'desc')])
}

export const getEmployeeById = async (id) => {
  return getDocument('employees', id)
}

export const addEmployee = async (data) => {
  return addDocument('employees', { ...data, status: 'active' })
}

export const updateEmployee = async (id, data) => {
  return updateDocument('employees', id, data)
}

export const deleteEmployee = async (id) => {
  return deleteDocument('employees', id)
}

// ─── Employee Attendance ─────────────────────────────────────────────────────

export const getEmployeeAttendance = async (employeeId, month, year) => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return getCollection('employee_attendance', [
    where('employeeId', '==', employeeId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
    orderBy('date', 'asc'),
  ])
}

// Fetch all attendance records for ALL employees for a full month
export const getAllEmployeeAttendanceByMonth = async (month, year) => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return getCollection('employee_attendance', [
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
  ])
}

export const getAllEmployeeAttendanceByDate = async (date) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return getCollection('employee_attendance', [
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
  ])
}

export const saveEmployeeAttendance = async (records) => {
  const promises = records.map((r) =>
    setDocument('employee_attendance', `${r.employeeId}_${r.dateStr}`, r)
  )
  return Promise.all(promises)
}

// ─── Student Attendance ──────────────────────────────────────────────────────

export const getStudentAttendance = async (studentId, month, year) => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return getCollection('student_attendance', [
    where('studentId', '==', studentId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
    orderBy('date', 'asc'),
  ])
}

export const getStudentAttendanceByClass = async (className, dateStr) => {
  return getCollection('student_attendance', [
    where('className', '==', className),
    where('dateStr', '==', dateStr),
  ])
}

export const saveStudentAttendance = async (records) => {
  const promises = records.map((r) =>
    setDocument('student_attendance', `${r.studentId}_${r.dateStr}`, r)
  )
  return Promise.all(promises)
}

// ─── Fees ─────────────────────────────────────────────────────────────────────

export const getFees = async (studentId) => {
  if (studentId) {
    return getCollection('fees', [where('studentId', '==', studentId), orderBy('createdAt', 'desc')])
  }
  return getCollection('fees', [orderBy('createdAt', 'desc')])
}

export const addFee = async (data) => {
  return addDocument('fees', data)
}

export const updateFee = async (id, data) => {
  return updateDocument('fees', id, data)
}

export const deleteFee = async (id) => {
  return deleteDocument('fees', id)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export const getPayments = async (studentId) => {
  if (studentId) {
    return getCollection('payments', [where('studentId', '==', studentId), orderBy('transactionDate', 'desc')])
  }
  return getCollection('payments', [orderBy('transactionDate', 'desc')])
}

export const addPayment = async (data) => {
  return addDocument('payments', data)
}

export const updatePayment = async (id, data) => {
  return updateDocument('payments', id, data)
}

// ─── Salary ───────────────────────────────────────────────────────────────────

export const getSalaries = async () => {
  return getCollection('salaries', [orderBy('createdAt', 'desc')])
}

export const getSalaryByEmployee = async (employeeId, month, year) => {
  return getCollection('salaries', [
    where('employeeId', '==', employeeId),
    where('month', '==', month),
    where('year', '==', year),
  ])
}

export const saveSalary = async (data) => {
  const existing = await getSalaryByEmployee(data.employeeId, data.month, data.year)
  if (existing.length > 0) {
    return updateDocument('salaries', existing[0].id, data)
  }
  return addDocument('salaries', data)
}

// ─── Fee Rules ────────────────────────────────────────────────────────────────
// Each document: { academicYear: '2025-2026', brackets: [{minAge, maxAge, fee}] }

export const getFeeRules = async () => {
  return getCollection('fee_rules', [orderBy('academicYear', 'asc')])
}

export const saveFeeRule = async (data) => {
  // Use academicYear as the document ID so there is always one doc per year
  return setDocument('fee_rules', data.academicYear, data)
}

export const deleteFeeRule = async (academicYear) => {
  return deleteDocument('fee_rules', academicYear)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async () => {
  return getDocument('settings', 'general')
}

export const updateSettings = async (data) => {
  return setDocument('settings', 'general', data)
}

// ─── Fee Ledger ───────────────────────────────────────────────────────────────
// One document per (studentId + periodKey).
// Doc ID: `{studentId}_{periodKey}`   e.g. "abc123_2026-04"
// Fields: studentId, periodKey, billingType, status, baseFee, fine, amountPaid,
//         dueDate, paidAt, razorpayPaymentId, razorpayOrderId

export const getFeeLedger = async (studentId) => {
  // No orderBy to avoid composite index requirement — sort client-side
  const docs = await getCollection('fee_ledger', [
    where('studentId', '==', studentId),
  ])
  return docs.sort((a, b) => (a.periodKey > b.periodKey ? 1 : -1))
}

export const getAllFeeLedger = async () => {
  const docs = await getCollection('fee_ledger', [])
  return docs.sort((a, b) => (a.periodKey > b.periodKey ? 1 : -1))
}

export const upsertFeeLedgerEntry = async (studentId, periodKey, data) => {
  const docId = `${studentId}_${periodKey}`
  return setDocument('fee_ledger', docId, { studentId, periodKey, ...data })
}

export const updateFeeLedgerEntry = async (studentId, periodKey, data) => {
  const docId = `${studentId}_${periodKey}`
  return updateDocument('fee_ledger', docId, data)
}

// ─── Payment Requests ─────────────────────────────────────────────────────────
// Collection: payment_requests
// Fields: studentId, studentName, className, billingPeriod, paymentType,
//         baseAmount, lateFee, totalAmount, referenceId, paymentDate,
//         remarks, status, submittedAt, verifiedBy, verifiedAt, rejectionReason

export const addPaymentRequest = async (data) => {
  return addDocument('payment_requests', data)
}

export const getPaymentRequests = async (studentId) => {
  if (studentId) {
    // No orderBy to avoid requiring a composite index — sort client-side
    const docs = await getCollection('payment_requests', [
      where('studentId', '==', studentId),
    ])
    return docs.sort((a, b) => {
      const aT = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0)
      const bT = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0)
      return bT - aT // desc
    })
  }
  // Admin: get all, sort client-side
  const docs = await getCollection('payment_requests', [])
  return docs.sort((a, b) => {
    const aT = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0)
    const bT = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0)
    return bT - aT
  })
}

export const updatePaymentRequest = async (id, data) => {
  return updateDocument('payment_requests', id, data)
}

// ─── Fine Waivers ─────────────────────────────────────────────────────────────
// Collection: fine_waivers
// Fields: studentId, studentName, periodKey, billingPeriod,
//         waivedAmount, adminId, adminName, reason, waivedAt

export const addFineWaiver = async (data) => {
  return addDocument('fine_waivers', data)
}

export const getFineWaivers = async (studentId) => {
  if (studentId) {
    return getCollection('fine_waivers', [where('studentId', '==', studentId)])
  }
  return getCollection('fine_waivers', [])
}

// ─── Fee Settings (billing type per student, global defaults) ─────────────────
// Stored under settings/fee_billing  → { defaultMonthlyDueDay, defaultQuarterlyDueDay }
// Per-student billing type is stored on the student doc itself (billingType field)

export const getFeeSettings = async () => {
  return getDocument('settings', 'fee_billing')
}

export const updateFeeSettings = async (data) => {
  return setDocument('settings', 'fee_billing', data)
}

// ─── Custom Fields ────────────────────────────────────────────────────────────
// Stored under settings/custom_fields → { studentFields: [...], employeeFields: [...] }
// Each field: { id, label, type: 'text'|'select', options?: [] }

export const getCustomFields = async () => {
  return getDocument('settings', 'custom_fields')
}

export const updateCustomFields = async (data) => {
  return setDocument('settings', 'custom_fields', data)
}

// ─── Form Options (editable dropdowns for Student/Employee forms) ─────────────
// Stored under settings/form_options
// Shape: { designations: [...], classes: [...], transportOptions: [...], genders: [...], niosSubGroups: [...] }

export const getFormOptions = async () => {
  return getDocument('settings', 'form_options')
}

export const updateFormOptions = async (data) => {
  return setDocument('settings', 'form_options', data)
}

// ─── Leave Requests (Employee) ────────────────────────────────────────────────
// Collection: leave_requests
// Fields: employeeId, employeeName, designation, fromDate, toDate, reason,
//         status ('Pending'|'Approved'|'Rejected'), rejectionReason,
//         submittedAt, reviewedBy, reviewedAt

export const addLeaveRequest = async (data) => {
  return addDocument('leave_requests', data)
}

export const getLeaveRequests = async (employeeId) => {
  if (employeeId) {
    const docs = await getCollection('leave_requests', [where('employeeId', '==', employeeId)])
    return docs.sort((a, b) => {
      const aT = a.submittedAt?.toDate?.() || new Date(0)
      const bT = b.submittedAt?.toDate?.() || new Date(0)
      return bT - aT
    })
  }
  const docs = await getCollection('leave_requests', [])
  return docs.sort((a, b) => {
    const aT = a.submittedAt?.toDate?.() || new Date(0)
    const bT = b.submittedAt?.toDate?.() || new Date(0)
    return bT - aT
  })
}

export const updateLeaveRequest = async (id, data) => {
  return updateDocument('leave_requests', id, data)
}

// ─── Student Leave Notifications ─────────────────────────────────────────────
// Collection: student_leaves
// Fields: studentId, studentName, className, fromDate, toDate, reason, submittedAt
// No approval workflow — admin views only

export const addStudentLeave = async (data) => {
  return addDocument('student_leaves', data)
}

export const getStudentLeaves = async (studentId) => {
  if (studentId) {
    const docs = await getCollection('student_leaves', [where('studentId', '==', studentId)])
    return docs.sort((a, b) => {
      const aT = a.submittedAt?.toDate?.() || new Date(0)
      const bT = b.submittedAt?.toDate?.() || new Date(0)
      return bT - aT
    })
  }
  const docs = await getCollection('student_leaves', [])
  return docs.sort((a, b) => {
    const aT = a.submittedAt?.toDate?.() || new Date(0)
    const bT = b.submittedAt?.toDate?.() || new Date(0)
    return bT - aT
  })
}

export { serverTimestamp, Timestamp, onSnapshot, query, collection, where, orderBy, db }
