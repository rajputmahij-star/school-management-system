import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DAYS, TIME_SLOTS, DEFAULT_TIMETABLE } from '../pages/shared/timetableConfig'

export const downloadTimetablePDF = (className, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  // Header
  doc.setFillColor(34, 139, 34)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ANAND SPECIAL SCHOOL', W / 2, 8, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`TIME TABLE (${className.toUpperCase()})`, W / 2, 14, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  const head = [['TIME', ...DAYS]]
  const body = TIME_SLOTS.map((slot) => {
    const row = [slot.label]
    DAYS.forEach((day) => {
      const cell = timetable?.[day]?.[slot.id] || ''
      row.push(cell)
    })
    return row
  })

  const dayColors = {
    MONDAY:    [255, 220, 220],
    TUESDAY:   [220, 230, 255],
    WEDNESDAY: [220, 255, 220],
    THURSDAY:  [255, 255, 200],
    FRIDAY:    [240, 220, 255],
  }

  autoTable(doc, {
    startY: 22,
    head,
    body,
    styles:      { fontSize: 7, cellPadding: 2, valign: 'middle', overflow: 'linebreak' },
    headStyles:  { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: 22 } },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) {
        const day = DAYS[data.column.index - 1]
        data.cell.styles.fillColor = dayColors[day] || [200, 200, 200]
        data.cell.styles.textColor = [0, 0, 0]
      }
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  })

  doc.setFontSize(6)
  doc.setTextColor(150)
  doc.text('Play • Learn • Grow Together', 14, H - 5)
  doc.text(`Printed: ${new Date().toLocaleDateString('en-IN')}`, W - 14, H - 5, { align: 'right' })

  doc.save(`timetable-${className}.pdf`)
}
