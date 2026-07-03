import * as XLSX from 'xlsx'
import { Timestamp } from 'firebase/firestore'

// ─── Column name → student field mapping ─────────────────────────────────────
// Flexible: handles variations in spacing/case
const COL_MAP = {
  'student id':             'studentId',
  'studentid':              'studentId',
  'student name':           'studentName',
  'studentname':            'studentName',
  'name':                   'studentName',
  'email':                  'email',
  'email address':          'email',
  'date of birth':          'dob',
  'dob':                    'dob',
  'birth date':             'dob',
  'gender':                 'gender',
  'nationality':            'nationality',
  'place of birth':         'placeOfBirth',
  'placeofbirth':           'placeOfBirth',
  'religion':               'religion',
  'mother tongue':          'motherTongue',
  'mothertongue':           'motherTongue',
  'aadhar number':          'aadharNumber',
  'aadhar':                 'aadharNumber',
  'aadharNumber':           'aadharNumber',
  'class':                  'className',
  'classname':              'className',
  'class educator':         'classEducator',
  'classeducator':          'classEducator',
  'teacher':                'classEducator',
  'gr number':              'grNumber',
  'grnumber':               'grNumber',
  'gr no':                  'grNumber',
  'date of admission':      'caseHistoryDate',
  'admission date':         'caseHistoryDate',
  'admissiondate':          'caseHistoryDate',
  'case history date':      'caseHistoryDate',
  'casehistorydate':        'caseHistoryDate',
  'leave date':             'leaveDate',
  'leavedate':              'leaveDate',
  'mode of transport':      'modeOfTransport',
  'modeoftransport':        'modeOfTransport',
  'transport':              'modeOfTransport',
  'fee amount':             'feeAmount',
  'feeamount':              'feeAmount',
  'monthly fee':            'feeAmount',
  'admission fee':          'admissionFee',
  'admissionfee':           'admissionFee',
  'deposit fee':            'depositFee',
  'depositfee':             'depositFee',
  'nios sub group':         'niosSubGroup',
  'niossubgroup':           'niosSubGroup',
  'nios fee':               'niosFee',
  'niosfee':                'niosFee',
  'father name':            'fatherName',
  'fathername':             'fatherName',
  'mother name':            'motherName',
  'mothername':             'motherName',
  'father qualification':   'fatherQualification',
  'mother qualification':   'motherQualification',
  'father occupation':      'fatherOccupation',
  'mother occupation':      'motherOccupation',
  'father office address':  'fatherOfficeAddress',
  'mother office address':  'motherOfficeAddress',
  'father contact':         'fatherContact',
  'mother contact':         'motherContact',
  'home address':           'homeAddress',
}

// ─── Normalise a header string to lookup key ─────────────────────────────────
const normalise = (str) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ')

// ─── Parse an Excel date serial or string into a JS Date ─────────────────────
const parseDate = (val) => {
  if (!val) return null
  if (val instanceof Date) return val
  // Excel serial number
  if (typeof val === 'number') {
    return XLSX.SSF.parse_date_code(val)
      ? new Date(Math.round((val - 25569) * 86400 * 1000))
      : null
  }
  // String like "2020-06-15" or "15/06/2020"
  const d = new Date(String(val))
  if (!isNaN(d.getTime())) return d
  // Try DD/MM/YYYY
  const parts = String(val).split('/')
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts
    const d2 = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`)
    if (!isNaN(d2.getTime())) return d2
  }
  return null
}

// ─── Parse Excel file → array of raw row objects ────────────────────────────
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' })
        resolve(raw)
      } catch (err) {
        reject(new Error('Failed to read Excel file: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Map raw rows → student data objects ─────────────────────────────────────
export const mapRowsToStudents = (rows) => {
  const errors = []
  const students = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // 1-indexed, +1 for header row
    const student = {}

    // Map each column
    Object.entries(row).forEach(([col, val]) => {
      const key = COL_MAP[normalise(col)]
      if (key) student[key] = String(val || '').trim()
    })

    // Validate required fields
    if (!student.studentName) {
      errors.push(`Row ${rowNum}: Student Name is required`)
      return
    }

    // Convert date fields to Firestore Timestamps
    const dateFields = ['dob', 'caseHistoryDate', 'admissionDate', 'leaveDate']
    dateFields.forEach((field) => {
      if (student[field]) {
        const d = parseDate(student[field])
        if (d) {
          student[field] = Timestamp.fromDate(d)
        } else {
          student[field] = null
        }
      } else {
        student[field] = null
      }
    })

    // Convert numeric fields
    const numFields = ['feeAmount', 'admissionFee', 'depositFee', 'niosFee']
    numFields.forEach((field) => {
      student[field] = student[field] ? Number(student[field]) || 0 : 0
    })

    students.push(student)
  })

  return { students, errors }
}

// ─── Generate a template Excel file for download ─────────────────────────────
export const downloadImportTemplate = () => {
  const headers = [
    'Student ID', 'Student Name', 'Email', 'Date of Birth', 'Gender',
    'Nationality', 'Place of Birth', 'Religion', 'Mother Tongue', 'Aadhar Number',
    'Class', 'Class Educator', 'GR Number',
    'Case History Date', 'Leave Date',
    'Mode of Transport', 'Fee Amount', 'Admission Fee', 'Deposit Fee',
    'NIOS Sub Group', 'NIOS Fee',
    'Father Name', 'Mother Name',
    'Father Qualification', 'Mother Qualification',
    'Father Occupation', 'Mother Occupation',
    'Father Office Address', 'Mother Office Address',
    'Father Contact', 'Mother Contact',
    'Home Address',
  ]

  // Sample row
  const sample = [
    'STU001', 'Aarav Sharma', 'aarav@example.com', '2010-06-15', 'Male',
    'Indian', 'Delhi', 'Hindu', 'Hindi', '123456789012',
    'Grade 5', 'Mrs. Priya', 'GR001',
    '2020-04-01', '',
    'Van', '15000', '5000', '2000',
    '', '',
    'Ramesh Sharma', 'Sunita Sharma',
    'Graduate', 'Graduate',
    'Business', 'Homemaker',
    '123 Main St, Delhi', '',
    '9876543210', '9876543211',
    '456 Colony, Delhi',
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, sample])

  // Style column widths
  ws['!cols'] = headers.map(() => ({ wch: 20 }))

  XLSX.utils.book_append_sheet(wb, ws, 'Students Import')
  XLSX.writeFile(wb, 'student_import_template.xlsx')
}
