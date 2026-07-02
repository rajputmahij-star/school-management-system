import jsPDF from 'jspdf'
import { numberToWords, formatDate } from './helpers'
import { loadPdfLogos, drawLetterhead } from './pdfLogos'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

const fmtRs = (v) => {
  if (v == null || isNaN(v)) return 'Rs. 0'
  return 'Rs. ' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
const str = (v) => (v == null || v === '' ? '—' : String(v))

export const generateSalarySlipPDF = async (salaryRecord, employee, settings = {}) => {
  const doc  = new jsPDF({ format: 'a4', unit: 'mm' })
  const W    = doc.internal.pageSize.width    // 210
  const H    = doc.internal.pageSize.height   // 297
  const M    = 14           // left/right margin
  const IW   = W - M * 2   // inner width = 182

  const FOOTER_TOP = H - 22   // footer starts at 275mm
  // Reserve space at bottom: footer(22) + stamp block(30) + gap(4) = 56mm from bottom
  const STAMP_TOP  = FOOTER_TOP - 34  // stamp block sits at ≈241mm

  const monthName = MONTHS[(salaryRecord.month || 1) - 1]
  const year      = salaryRecord.year || new Date().getFullYear()

  const logos = await loadPdfLogos()
  let y = await drawLetterhead(doc, logos, 'SALARY STATEMENT', `Month: ${monthName} ${year}`)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hr = (yy) => {
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.25)
    doc.line(M, yy, M + IW, yy)
  }

  const card = (yy, h) => {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(200, 210, 220)
    doc.setLineWidth(0.4)
    doc.roundedRect(M, yy, IW, h, 2, 2, 'FD')
  }

  const band = (title, yy, r, g, b) => {
    doc.setFillColor(r, g, b)
    doc.roundedRect(M, yy, IW, 8, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, M + 4, yy + 5.5)
    doc.setTextColor(0, 0, 0)
    return yy + 11
  }

  const row = (label, value, yy, bold = false, clr = [55, 65, 81]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...clr)
    doc.text(str(label), M + 3, yy)
    doc.text(str(value), M + IW - 3, yy, { align: 'right' })
    return yy + 8
  }

  // ── EMPLOYEE DETAILS CARD ─────────────────────────────────────────────────
  const CARD_H = 50
  card(y, CARD_H)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('EMPLOYEE DETAILS', M + 4, y + 6)

  const half = IW / 2
  const dets = [
    ['Employee Name', str(employee.employeeName || salaryRecord.employeeName)],
    ['Employee ID',   str(employee.employeeId)],
    ['Designation',   str(employee.designation)],
    ['Joining Date',  formatDate(employee.joiningDate)],
    ['PAN Number',    str(employee.panNumber)],
    ['Bank Name',     str(employee.bankName)],
    ['Account No.',   str(employee.bankAccount)],
    ['IFSC Code',     str(employee.ifscCode)],
  ]
  dets.forEach(([lbl, val], i) => {
    const cx  = M + 4 + (i % 2) * half
    const cy  = y + 14 + Math.floor(i / 2) * 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text(lbl + ':', cx, cy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text((doc.splitTextToSize(val, half - 30)[0] || val), cx + 28, cy)
  })
  y += CARD_H + 6

  // ── INCOME ────────────────────────────────────────────────────────────────
  y = band('INCOME', y, 37, 99, 235)
  y = row('Monthly Salary', fmtRs(salaryRecord.monthlySalary), y)
  y = row('Present Days / Month Days',
    `${salaryRecord.presentDays ?? 0} / ${salaryRecord.monthDays ?? 0} days`, y)
  hr(y - 2)
  y = row('Salary Earned', fmtRs(salaryRecord.salaryEarned), y + 1, true, [10, 60, 20])
  y += 5

  // ── DEDUCTIONS ────────────────────────────────────────────────────────────
  y = band('DEDUCTIONS', y, 200, 50, 50)
  const totalDed = (salaryRecord.deduction || 0) + (salaryRecord.smcTax || 0)
  y = row('5% Deduction', fmtRs(salaryRecord.deduction), y)
  y = row('Professional Tax (Surat Municipal Corporation)',
    salaryRecord.smcTax > 0 ? fmtRs(salaryRecord.smcTax) : 'Nil', y)
  hr(y - 2)
  y = row('Total Deductions', fmtRs(totalDed), y + 1, true, [160, 20, 20])
  y += 5

  // ── NET SALARY BAR ────────────────────────────────────────────────────────
  doc.setFillColor(10, 90, 40)
  doc.roundedRect(M, y, IW, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('NET SALARY', M + 5, y + 10)
  doc.text(fmtRs(salaryRecord.netSalary), M + IW - 5, y + 10, { align: 'right' })
  y += 18

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(80, 90, 110)
  doc.text(`In Words: ${numberToWords(salaryRecord.netSalary || 0)}`, M + 3, y)
  y += 9

  // ── PAYMENT INFO CARD ─────────────────────────────────────────────────────
  // Height = 28mm; must fit above STAMP_TOP
  const PAY_H = 28
  card(y, PAY_H)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('PAYMENT INFORMATION', M + 4, y + 6)

  const payItems = [
    ['Status',       str(salaryRecord.status || 'Pending')],
    ['Reference ID', str(salaryRecord.referenceId)],
    ['Pay Date',     salaryRecord.payDate ? formatDate(salaryRecord.payDate) : '—'],
  ]
  const c3 = IW / 3
  payItems.forEach(([lbl, val], i) => {
    const x = M + 4 + i * c3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text(lbl + ':', x, y + 14)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(val, x, y + 21)
  })
  // y after payment card
  y += PAY_H

  // ── STAMP & SIGNATURE ─────────────────────────────────────────────────────
  // Always at fixed STAMP_TOP — guaranteed above footer, never overlaps content
  const SY      = STAMP_TOP          // ≈ 241mm
  const STAMP_W = 55                 // width of stamp box
  const STAMP_H = 22                 // height of stamp box
  const SIG_W   = 60                 // width of signature area

  // "OFFICIAL STAMP" label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('OFFICIAL STAMP', M, SY - 3)

  // Dashed stamp box
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.5)
  doc.setLineDashPattern([2, 2], 0)
  doc.roundedRect(M, SY, STAMP_W, STAMP_H, 2, 2)
  doc.setLineDashPattern([], 0)

  // "AUTHORISED SIGNATORY" label
  const sigX = M + IW - SIG_W
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('AUTHORISED SIGNATORY', sigX, SY - 3)

  // Signature line
  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.5)
  doc.line(sigX, SY + STAMP_H, M + IW, SY + STAMP_H)

  // "(Signature & Seal)" caption
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text('(Signature & Seal)', sigX + 5, SY + STAMP_H + 5)

  return doc
}

export const downloadSalarySlip = async (salaryRecord, employee, settings) => {
  const doc  = await generateSalarySlipPDF(salaryRecord, employee, settings)
  const name = `salary-slip-${(employee.employeeName || 'employee').replace(/\s+/g, '-')}-${salaryRecord.month}-${salaryRecord.year}.pdf`
  doc.save(name)
}

export const viewSalarySlip = async (salaryRecord, employee, settings) => {
  const doc = await generateSalarySlipPDF(salaryRecord, employee, settings)
  window.open(doc.output('bloburl'), '_blank')
}

export const printSalarySlip = async (salaryRecord, employee, settings) => {
  const doc = await generateSalarySlipPDF(salaryRecord, employee, settings)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}
