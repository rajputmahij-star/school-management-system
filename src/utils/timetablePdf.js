import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DAYS, TIME_SLOTS, DEFAULT_TIMETABLE } from '../pages/shared/timetableConfig'

// Helper to normalize cell data (handle both legacy strings and rich objects)
const toCell = (v) => {
  if (!v) return { text: '', bold: false, italic: false, underline: false, color: '', bgColor: '' }
  if (typeof v === 'string') {
    const text = v.replace(/<[^>]*>/g, '')
    return { text, bold: false, italic: false, underline: false, color: '', bgColor: '' }
  }
  return { text: '', bold: false, italic: false, underline: false, color: '', bgColor: '', ...v }
}

// Convert hex color to RGB array for jsPDF
const hexToRgb = (hex) => {
  if (!hex || hex === '') return null
  const cleaned = hex.replace('#', '')
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return [r, g, b]
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16)
    const g = parseInt(cleaned.substring(2, 4), 16)
    const b = parseInt(cleaned.substring(4, 6), 16)
    return [r, g, b]
  }
  return null
}

export const downloadTimetablePDF = (className, timetable) => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const W = doc.internal.pageSize.width
  const H = doc.internal.pageSize.height

  // Get current month and year
  const now = new Date()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  const monthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`
  const lastUpdated = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  // Header with gradient-like blue
  doc.setFillColor(22, 55, 122) // #16377A
  doc.rect(0, 0, W, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ANAND SPECIAL SCHOOL', W / 2, 6, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('(Mngd. By Anand Rehabilitation Trust)', W / 2, 10, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`TIME TABLE — ${className.toUpperCase()}`, W / 2, 14, { align: 'center' })
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`${monthYear} • Last Updated: ${lastUpdated}`, W / 2, 18, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  const head = [['TIME', ...DAYS]]
  
  // Store cell data with formatting info
  const cellData = {}
  const body = TIME_SLOTS.map((slot, rowIndex) => {
    const row = [slot.label]
    DAYS.forEach((day, colIndex) => {
      const rawCell = timetable?.[day]?.[slot.id]
      const cell = toCell(rawCell)
      row.push(cell.text || '')
      
      // Store formatting data for later use
      cellData[`${rowIndex}-${colIndex + 1}`] = cell
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
    startY: 24,
    head,
    body,
    styles: { 
      fontSize: 6.5,
      cellPadding: 1.5, 
      valign: 'middle', 
      overflow: 'linebreak',
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [100, 100, 100], 
      textColor: 255, 
      fontStyle: 'bold', 
      halign: 'center',
      fontSize: 7
    },
    columnStyles: { 
      0: { 
        fillColor: [240, 240, 240], 
        fontStyle: 'bold', 
        cellWidth: 20,
        halign: 'center',
        fontSize: 6
      } 
    },
    didParseCell: (data) => {
      // Style day header cells
      if (data.section === 'head' && data.column.index > 0) {
        const day = DAYS[data.column.index - 1]
        data.cell.styles.fillColor = dayColors[day] || [200, 200, 200]
        data.cell.styles.textColor = [0, 0, 0]
      }
      
      // Apply custom formatting to body cells
      if (data.section === 'body' && data.column.index > 0) {
        const key = `${data.row.index}-${data.column.index}`
        const cell = cellData[key]
        
        if (cell) {
          // Apply font style (bold/italic)
          let fontStyle = 'normal'
          if (cell.bold && cell.italic) fontStyle = 'bolditalic'
          else if (cell.bold) fontStyle = 'bold'
          else if (cell.italic) fontStyle = 'italic'
          data.cell.styles.fontStyle = fontStyle
          
          // Apply underline
          if (cell.underline) {
            data.cell.styles.textDecoration = 'underline'
          }
          
          // Apply text color
          if (cell.color) {
            const rgb = hexToRgb(cell.color)
            if (rgb) {
              data.cell.styles.textColor = rgb
            }
          }
          
          // Apply background color
          if (cell.bgColor) {
            const rgb = hexToRgb(cell.bgColor)
            if (rgb) {
              data.cell.styles.fillColor = rgb
            }
          } else {
            // Default alternate row styling if no custom bg
            if (data.row.index % 2 === 1) {
              data.cell.styles.fillColor = [252, 252, 252]
            }
          }
        }
      }
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  })

  // Footer
  const finalY = doc.lastAutoTable.finalY || H - 20
  doc.setFillColor(248, 250, 255)
  doc.rect(0, finalY, W, 8, 'F')
  doc.setDrawColor(22, 55, 122)
  doc.setLineWidth(0.5)
  doc.line(14, finalY, W - 14, finalY)
  
  doc.setFontSize(8)
  doc.setTextColor(22, 55, 122)
  doc.setFont('helvetica', 'italic')
  doc.text('Play • Learn • Grow Together', W / 2, finalY + 5, { align: 'center' })
  
  doc.setFontSize(6)
  doc.setTextColor(150)
  doc.setFont('helvetica', 'normal')
  doc.text(`Printed: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, W - 14, H - 5, { align: 'right' })

  doc.save(`timetable-${className}.pdf`)
}
