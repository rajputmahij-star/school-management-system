import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, formatCurrency } from './helpers'
import { loadPdfLogos, drawLetterhead } from './pdfLogos'

const fmtRs = (v) => {
  if (v == null || isNaN(v)) return 'Rs. 0'
  return 'Rs. ' + Math.floor(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 0 })
}

const str = (v) => (v == null || v === '' ? '—' : String(v))

// ─── Student / Employee reports ───────────────────────────────────────────────

export const generateStudentReport = async (students) => {
  const doc   = new jsPDF()
  const logos = await loadPdfLogos()
  const y     = await drawLetterhead(doc, logos, 'STUDENT REPORT', `Generated: ${formatDate(new Date())}`)

  autoTable(doc, {
    startY: y,
    head: [['ID', 'Name', 'Father', 'Class', 'GR No.', 'Admission', 'Status']],
    body: students.map((s) => [
      s.studentId, s.studentName, s.fatherName, s.className,
      s.grNumber, formatDate(s.admissionDate), s.leaveDate ? 'Left' : 'Active',
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 100, 50] },
    alternateRowStyles: { fillColor: [240, 250, 240] },
    margin: { bottom: 26 },
  })
  doc.save('student-report.pdf')
}

export const generateEmployeeReport = async (employees) => {
  const doc   = new jsPDF()
  const logos = await loadPdfLogos()
  const y     = await drawLetterhead(doc, logos, 'EMPLOYEE REPORT', `Generated: ${formatDate(new Date())}`)

  autoTable(doc, {
    startY: y,
    head: [['ID', 'Name', 'Designation', 'Joining Date', 'Salary', 'Status']],
    body: employees.map((e) => [
      e.employeeId, e.employeeName, e.designation,
      formatDate(e.joiningDate), formatCurrency(e.monthlySalary), e.status,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 100, 50] },
    alternateRowStyles: { fillColor: [240, 250, 240] },
    margin: { bottom: 26 },
  })
  doc.save('employee-report.pdf')
}

// ─── Fee receipt (offline payment_request — main receipt used in app) ────────
export const generateRequestReceipt = async (req, student) => {
  const doc   = new jsPDF({ format: 'a4', unit: 'mm' })
  const W     = doc.internal.pageSize.width
  const H     = doc.internal.pageSize.height
  const M     = 14
  const IW    = W - M * 2
  const logos = await loadPdfLogos()

  // Use the receipt number from the request if available
  const receiptNo = req.receiptNumber || `LEGACY-${req.id?.slice(0, 8).toUpperCase() || 'N/A'}`

  let y = await drawLetterhead(
    doc, logos,
    'FEE RECEIPT',
    `Date: ${formatDate(req.verifiedAt)}  |  Receipt No: ${receiptNo}`
  )

  // ── Helpers ──────────────────────────────────────────────────────────────
  const hr = () => {
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.25)
    doc.line(M, y - 1, M + IW, y - 1)
    y += 3
  }

  const band = (title, r = 15, g = 100, b = 50) => {
    doc.setFillColor(r, g, b)
    doc.roundedRect(M, y, IW, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, M + 4, y + 5.5)
    doc.setTextColor(0, 0, 0)
    y += 11
  }

  const field = (label, value, bold = false, valClr = [15, 23, 42]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(label, M + 4, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...valClr)
    const valueStr = str(value)
    doc.text(valueStr, M + IW - 4, y, { align: 'right' })
    y += 7
  }

  // ── STUDENT INFO ──────────────────────────────────────────────────────────
  y += 2
  band('STUDENT INFORMATION', 15, 100, 50)
  field('Student Name:', student?.studentName || req.studentName)
  field('Class:', student?.className || req.className)
  field('GR Number:', student?.grNumber)
  field('Student ID:', student?.studentId)
  y += 4

  // ── FEE DETAILS ───────────────────────────────────────────────────────────
  band('FEE DETAILS', 22, 55, 122)
  field('Billing Period:', req.billingPeriod)
  field('Payment Type:', req.paymentType)
  field('Payment Mode:', req.paymentMode || 'Not Specified')
  field('Tuition Fee:', fmtRs(req.baseAmount))
  field('Late Fee (if any):', req.lateFee > 0 ? fmtRs(req.lateFee) : 'None')

  // Total / Paid / Remaining
  const totalFee  = (req.baseAmount || 0) + (req.lateFee || 0)
  const paid      = req.paidAmount || req.totalAmount || 0
  const remaining = req.remainingAmount || Math.max(0, totalFee - paid)

  hr()
  field('Total Fee:', fmtRs(totalFee), false)
  field('Amount Paid:', fmtRs(paid), true, [10, 90, 40])
  if (remaining > 0) {
    field('Remaining Balance:', fmtRs(remaining), true, [170, 25, 25])
  }
  if (req.isPartialPayment) {
    y += 2
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(170, 25, 25)
    doc.text('* Partial Payment - Remaining amount will be added to next period', M + 4, y)
    y += 2
  }
  y += 4

  // ── AMOUNT PAID BAR ───────────────────────────────────────────────────────
  doc.setFillColor(10, 90, 40)
  doc.roundedRect(M, y, IW, 13, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('AMOUNT PAID', M + 5, y + 9)
  doc.text(fmtRs(paid), M + IW - 5, y + 9, { align: 'right' })
  y += 18

  // ── VERIFICATION ─────────────────────────────────────────────────────────
  band('VERIFICATION', 22, 55, 122)
  field('Payment Status:', 'PAID & VERIFIED', true, [10, 90, 40])
  field('Payment Mode:', req.paymentMode || 'Not Specified')
  field('Reference ID:', req.referenceId)
  field('Payment Date:', req.paymentDate)
  field('Verified By:', req.verifiedBy || 'Admin')
  field('Verified On:', formatDate(req.verifiedAt))
  y += 6

  // ── THANK YOU NOTE (no stamp/signature for fee receipt) ───────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Thank you. This is a computer-generated receipt and does not require a signature.', W / 2, y, { align: 'center' })

  doc.save(`fee-receipt-${receiptNo}.pdf`)
}

// ─── Salary receipt ───────────────────────────────────────────────────────────
export const generateSalaryReceipt = async (salary, employee) => {
  const doc   = new jsPDF({ format: 'a4', unit: 'mm' })
  const W     = doc.internal.pageSize.width
  const H     = doc.internal.pageSize.height
  const M     = 14
  const IW    = W - M * 2
  const logos = await loadPdfLogos()

  // Use the receipt number from the salary if available
  const receiptNo = salary.receiptNumber || `LEGACY-${salary.id?.slice(0, 8).toUpperCase() || 'N/A'}`

  let y = await drawLetterhead(
    doc, logos,
    'SALARY RECEIPT',
    `Date: ${formatDate(salary.payDate)}  |  Receipt No: ${receiptNo}`
  )

  // ── Helpers ──────────────────────────────────────────────────────────────
  const hr = () => {
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.25)
    doc.line(M, y - 1, M + IW, y - 1)
    y += 3
  }

  const band = (title, r = 15, g = 100, b = 50) => {
    doc.setFillColor(r, g, b)
    doc.roundedRect(M, y, IW, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, M + 4, y + 5.5)
    doc.setTextColor(0, 0, 0)
    y += 11
  }

  const field = (label, value, bold = false, valClr = [15, 23, 42]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(label, M + 4, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...valClr)
    const valueStr = str(value)
    doc.text(valueStr, M + IW - 4, y, { align: 'right' })
    y += 7
  }

  // ── EMPLOYEE INFO ─────────────────────────────────────────────────────────
  y += 2
  band('EMPLOYEE INFORMATION', 15, 100, 50)
  field('Employee Name:', employee?.employeeName || salary.employeeName)
  field('Designation:', employee?.designation || salary.designation)
  field('Employee ID:', employee?.employeeId || salary.employeeId)
  y += 4

  // ── SALARY DETAILS ────────────────────────────────────────────────────────
  band('SALARY DETAILS', 22, 55, 122)
  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']
  const monthName = MONTHS[(salary.month || 1) - 1]
  field('Period:', `${monthName} ${salary.year}`)
  field('Monthly Salary:', fmtRs(salary.monthlySalary))
  field('Present Days:', `${salary.presentDays || 0} / ${salary.monthDays || 30}`)
  field('Salary Earned:', fmtRs(salary.salaryEarned || 0))
  if (salary.deduction > 0) {
    field('Deduction:', fmtRs(salary.deduction), false, [170, 25, 25])
  }
  if (salary.smcTax > 0) {
    field('SMC Tax:', fmtRs(salary.smcTax), false, [170, 25, 25])
  }

  hr()
  field('Net Salary:', fmtRs(salary.netSalary), true, [10, 90, 40])
  y += 4

  // ── NET SALARY BAR ────────────────────────────────────────────────────────
  doc.setFillColor(10, 90, 40)
  doc.roundedRect(M, y, IW, 13, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('NET SALARY PAID', M + 5, y + 9)
  doc.text(fmtRs(salary.netSalary), M + IW - 5, y + 9, { align: 'right' })
  y += 18

  // ── PAYMENT DETAILS ───────────────────────────────────────────────────────
  band('PAYMENT DETAILS', 22, 55, 122)
  field('Payment Status:', 'PAID', true, [10, 90, 40])
  field('Reference ID:', salary.referenceId)
  field('Payment Date:', formatDate(salary.payDate))
  y += 6

  // ── THANK YOU NOTE ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Thank you. This is a computer-generated receipt and does not require a signature.', W / 2, y, { align: 'center' })

  doc.save(`salary-receipt-${receiptNo}.pdf`)
}

// ─── Legacy Razorpay receipt (kept for backward compat) ──────────────────────
export const generatePaymentReceipt = async (payment, student, fee) => {
  const doc   = new jsPDF({ format: 'a4', unit: 'mm' })
  const W     = doc.internal.pageSize.width
  const M     = 14
  const IW    = W - M * 2
  const logos = await loadPdfLogos()

  let y = await drawLetterhead(doc, logos, 'FEE RECEIPT', `Date: ${formatDate(payment.transactionDate)}`)

  const field = (label, value, bold = false) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(label, M + 4, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(str(value), M + IW - 4, y, { align: 'right' })
    y += 8
  }
  const hr = () => {
    doc.setDrawColor(210, 210, 210)
    doc.line(M, y - 1, M + IW, y - 1)
    y += 3
  }
  const band = (title, r, g, b) => {
    doc.setFillColor(r, g, b)
    doc.roundedRect(M, y, IW, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, M + 4, y + 5.5)
    doc.setTextColor(0, 0, 0)
    y += 11
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(22, 55, 122)
  doc.text(`Receipt No: ${str(payment.id?.slice(0, 8).toUpperCase())}`, M + 4, y)
  y += 10

  band('STUDENT INFORMATION', 15, 100, 50)
  field('Student Name:', student?.studentName)
  field('Class:', student?.className)
  field('GR Number:', student?.grNumber)
  field('Father Name:', student?.fatherName)
  y += 2

  band('PAYMENT DETAILS', 22, 55, 122)
  field('Fee Type:', fee?.feeType)
  field('Tuition Fee:', fmtRs(payment.amount))
  field('Late Fee (if any):', fmtRs(payment.fine || 0))
  hr()
  field('Total Paid:', fmtRs(payment.totalAmount), true)
  field('Payment Status:', payment.paymentStatus)
  field('Transaction ID:', payment.razorpayPaymentId || 'N/A')
  y += 6

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Thank you. This is a computer-generated receipt.', W / 2, y, { align: 'center' })

  doc.save(`receipt-${str(payment.id?.slice(0, 8))}.pdf`)
}

// ─── Attendance report ────────────────────────────────────────────────────────
export const generateAttendanceReport = async (attendanceData, title) => {
  const doc   = new jsPDF()
  const logos = await loadPdfLogos()
  const y     = await drawLetterhead(doc, logos, title.toUpperCase(), `Generated: ${formatDate(new Date())}`)

  autoTable(doc, {
    startY: y,
    head: [['Name', 'Present', 'Absent', 'Half Day', 'Leave', 'Total', '%']],
    body: attendanceData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 100, 50] },
    alternateRowStyles: { fillColor: [240, 250, 240] },
    margin: { bottom: 26 },
  })
  doc.save('attendance-report.pdf')
}

// ─── Fee collection report ────────────────────────────────────────────────────
export const generateFeeCollectionReport = async (payments, month, year) => {
  const doc   = new jsPDF()
  const logos = await loadPdfLogos()
  const y     = await drawLetterhead(
    doc, logos, 'FEE COLLECTION REPORT',
    `Period: ${month}/${year}  |  Generated: ${formatDate(new Date())}`
  )
  const total = payments.reduce((s, p) => s + (p.totalAmount || 0), 0)

  autoTable(doc, {
    startY: y,
    head: [['Student', 'Fee Type', 'Amount', 'Late Fee (if any)', 'Total', 'Date', 'Status']],
    body: payments.map((p) => [
      p.studentName, p.feeType, formatCurrency(p.amount),
      p.fine > 0 ? formatCurrency(p.fine) : 'None',
      formatCurrency(p.totalAmount), formatDate(p.transactionDate), p.paymentStatus,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 100, 50] },
    alternateRowStyles: { fillColor: [240, 250, 240] },
    foot: [['', '', '', 'Total:', formatCurrency(total), '', '']],
    footStyles: { fillColor: [22, 55, 122], textColor: 255, fontStyle: 'bold' },
    margin: { bottom: 26 },
  })
  doc.save(`fee-collection-${month}-${year}.pdf`)
}

// ─── Salary report (landscape) ───────────────────────────────────────────────
export const generateSalaryReport = async (salaries, month, year) => {
  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']
  const monthName = MONTHS[(month || 1) - 1]

  const doc   = new jsPDF({ orientation: 'landscape' })
  const logos = await loadPdfLogos()
  const y     = await drawLetterhead(
    doc, logos, 'SALARY REPORT',
    `${monthName} ${year}  |  Generated: ${formatDate(new Date())}`
  )
  const total = salaries.reduce((s, r) => s + (r.netSalary || 0), 0)

  autoTable(doc, {
    startY: y,
    head: [[
      'Employee Name', 'Employee ID', 'Designation',
      'Monthly Salary', 'Present Days', 'Month Days',
      'Net Salary', 'Status', 'Pay Date', 'Reference ID',
    ]],
    body: salaries.map((s) => [
      s.employeeName  || '—', s.employeeId   || '—', s.designation || '—',
      fmtRs(s.monthlySalary),
      s.presentDays != null ? String(s.presentDays) : '—',
      s.monthDays    != null ? String(s.monthDays)   : '—',
      fmtRs(s.netSalary), s.status || '—',
      s.payDate ? formatDate(s.payDate) : '—',
      s.referenceId || '—',
    ]),
    foot: [[{
      content: `Total Net Salary: ${fmtRs(total)}`, colSpan: 10,
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [22, 55, 122], textColor: 255 },
    }]],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 100, 50], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 250, 240] },
    footStyles: { fillColor: [22, 55, 122], textColor: 255, fontStyle: 'bold' },
    margin: { bottom: 26 },
  })
  doc.save(`salary-report-${monthName}-${year}.pdf`)
}
