import * as XLSX from 'xlsx'
import { formatDate, formatCurrency } from './helpers'

const saveWorkbook = (wb, filename) => {
  XLSX.writeFile(wb, filename)
}

export const exportStudentsToExcel = (students) => {
  const data = students.map((s) => ({
    'Student ID': s.studentId,
    'Student Name': s.studentName,
    'Father Name': s.fatherName,
    'Mother Name': s.motherName,
    'Date of Birth': formatDate(s.dob),
    'Class': s.className,
    'Class Educator': s.classEducator || s.classTeacher,
    'GR Number': s.grNumber,
    'Date of Admission': formatDate(s.admissionDate),
    'Mode of Transport': s.modeOfTransport || '',
    'Fee Amount': s.feeAmount,
    'Status': s.leaveDate ? 'Left' : 'Active',
    'Leave Date': s.leaveDate ? formatDate(s.leaveDate) : '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  saveWorkbook(wb, 'students.xlsx')
}

export const exportEmployeesToExcel = (employees) => {
  const data = employees.map((e) => ({
    'Employee ID': e.employeeId,
    'Employee Name': e.employeeName,
    'Designation': e.designation,
    'Joining Date': formatDate(e.joiningDate),
    'Monthly Salary': e.monthlySalary,
    'Status': e.status,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  saveWorkbook(wb, 'employees.xlsx')
}

export const exportPaymentsToExcel = (payments) => {
  const data = payments.map((p) => ({
    'Payment ID': p.id,
    'Student Name': p.studentName,
    'Fee Type': p.feeType,
    'Amount': p.amount,
    'Fine': p.fine || 0,
    'Total Amount': p.totalAmount,
    'Status': p.paymentStatus,
    'Transaction Date': formatDate(p.transactionDate),
    'Transaction ID': p.razorpayPaymentId || '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Payments')
  saveWorkbook(wb, 'payments.xlsx')
}

export const exportSalaryToExcel = (salaries) => {
  const data = salaries.map((s) => ({
    'Employee Name': s.employeeName,
    'Designation': s.designation,
    'Month': s.month,
    'Year': s.year,
    'Monthly Salary': s.monthlySalary,
    'Working Days': s.workingDays,
    'Present Days': s.presentDays,
    'Per Day Salary': s.perDaySalary,
    'Salary Earned': s.salaryEarned,
    'Status': s.status,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Salary')
  saveWorkbook(wb, 'salary-report.xlsx')
}
