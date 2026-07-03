import { getCollection, addDocument, updateDocument, where, serverTimestamp } from '../firebase/firestore'
import { Timestamp } from 'firebase/firestore'

/**
 * Get current academic year in format YYYY
 * Academic year: April to March (e.g., 2026-27 = 2627)
 */
const getAcademicYear = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  
  if (month >= 4) {
    // April onwards = current year - next year
    const nextYear = year + 1
    // Extract last 2 digits of each year: 2026 -> 26, 2027 -> 27 = "2627"
    return String(year).slice(-2) + String(nextYear).slice(-2)
  } else {
    // Jan-March = previous year - current year
    const prevYear = year - 1
    // Extract last 2 digits of each year: 2025 -> 25, 2026 -> 26 = "2526"
    return String(prevYear).slice(-2) + String(year).slice(-2)
  }
}

/**
 * Generate a unique receipt number
 * Format: AAAA + DD + MM + YY + HH + MM + NNN
 * Example: 262703072612001
 * - 2627 = Academic Year 2026-27
 * - 03 = Day 03
 * - 07 = Month July
 * - 26 = Year 2026 (last 2 digits)
 * - 12 = Hour 12
 * - 12 = Minute 12
 * - 001 = Sequence number (incremented yearly per type)
 * 
 * @param {string} type - 'fee' or 'salary'
 * @returns {Promise<string>} The generated receipt number
 */
export const generateReceiptNumber = async (type) => {
  try {
    const now = new Date()
    const academicYear = getAcademicYear() // e.g., "2627" for 2026-27
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear()).slice(-2) // Last 2 digits
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    
    console.log('Generating receipt number for type:', type, 'Academic Year:', academicYear)
    
    // Get the last receipt number for this type and academic year
    const receipts = await getCollection('receipt_counters', [
      where('type', '==', type),
      where('academicYear', '==', academicYear)
    ])
    
    console.log('Found receipts:', receipts)
    
    let sequenceNum = 1
    let counterId = null
    
    if (receipts.length > 0) {
      // Sort by sequence to get the latest
      const sorted = receipts.sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
      const latest = sorted[0]
      sequenceNum = (latest.sequence || 0) + 1
      counterId = latest.id
      console.log('Latest sequence:', latest.sequence, 'New sequence:', sequenceNum)
    }
    
    // Pad sequence number to 3 digits
    const sequence = String(sequenceNum).padStart(3, '0')
    
    // Construct receipt number: AAAADDMMYYHHMMMNNN (17 digits total)
    const receiptNumber = `${academicYear}${day}${month}${year}${hour}${minute}${sequence}`
    
    console.log('Generated receipt number:', receiptNumber)
    
    // Update or create the counter document
    if (counterId) {
      await updateDocument('receipt_counters', counterId, {
        sequence: sequenceNum,
        lastUsed: Timestamp.fromDate(now)
      })
      console.log('Updated counter:', counterId)
    } else {
      const newDoc = await addDocument('receipt_counters', {
        type,
        academicYear,
        sequence: sequenceNum,
        lastUsed: Timestamp.fromDate(now),
        createdAt: Timestamp.fromDate(now)
      })
      console.log('Created new counter:', newDoc)
    }
    
    return receiptNumber
  } catch (error) {
    console.error('Error generating receipt number:', error)
    console.error('Error details:', error.message, error.stack)
    
    // Fallback: generate a date-time based receipt number
    const now = new Date()
    const academicYear = getAcademicYear()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear()).slice(-2)
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    
    // Fallback format: AAAADDMMYYHHMMSS (16 digits)
    const fallbackNumber = `${academicYear}${day}${month}${year}${hour}${minute}${second}`
    console.log('Using fallback receipt number:', fallbackNumber)
    return fallbackNumber
  }
}

/**
 * Get receipt information including academic year, date, time
 * @returns {Object} Receipt metadata
 */
export const getReceiptMetadata = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  
  // Academic year calculation: April to March
  const academicYear = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
  
  return {
    academicYear,
    date: now.toLocaleDateString('en-IN'),
    time: now.toLocaleTimeString('en-IN', { hour12: false }),
    timestamp: now
  }
}
