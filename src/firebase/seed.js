/**
 * ANAND School Management System — Firebase Seed Script
 * -------------------------------------------------------
 * Run this once in the browser console after logging into Firebase
 * OR use the Firebase Admin SDK in a Node script.
 *
 * This creates:
 *  - 1 Admin user entry
 *  - Sample settings
 
 * To use:
 * 1. Create users in Firebase Authentication console (Email/Password)
 * 2. Note their UIDs
 * 3. Use Firestore console or this script to create documents
 *
 * ADMIN DOC: admins/{uid}
 * {
 *   adminName: "Admin Name",
 *   email: "admin@school.com",
 *   role: "admin"
 * }
 *
 * EMPLOYEE DOC: employees/{uid}
 * {
 *   employeeId: "EMP2026001",
 *   employeeName: "Educator Name",
 *   designation: "Educator",      // Must be an Educator role to access student attendance
 *   assignedClass: "Primary-I",   // Restricts attendance and timetable to this class
 *   joiningDate: Timestamp,
 *   monthlySalary: 25000,
 *   status: "active",
 *   email: "educator@school.com",
 *   uid: "{firebase_uid}"
 * }
 *
 * STUDENT DOC: students/{auto_id}
 * {
 *   uid: "{firebase_uid}",        // Link to Firebase Auth user
 *   studentId: "STU2026001",
 *   studentName: "Student Name",
 *   fatherName: "Father Name",
 *   motherName: "Mother Name",
 *   dob: Timestamp,
 *   className: "10",
 *   classTeacher: "Mr. Sharma",   // Legacy — use classEducator now
 *   grNumber: "GR001",
 *   admissionDate: Timestamp,
 *   feeAmount: 5000,
 *   leaveDate: null,             // null = active student
 *   status: "active"
 * }
 *
 * SETTINGS DOC: settings/general
 * {
 *   schoolName: "ANAND School",
 *   principalName: "Principal Name",
 *   workingDaysPerMonth: 26,
 *   lateFeeBase: 250,
 *   lateFeePerDay: 25,
 *   academicYear: "2025-26"
 * }
 */

import { db } from './config'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

export const seedSettings = async () => {
  await setDoc(doc(db, 'settings', 'general'), {
    schoolName: 'ANAND School',
    address: 'School Address Here',
    phone: '+91 98765 43210',
    email: 'admin@anandschool.com',
    principalName: 'Principal Name',
    workingDaysPerMonth: 26,
    academicYear: '2025-26',
    lateFeeBase: 250,
    lateFeePerDay: 25,
    updatedAt: serverTimestamp(),
  })
  console.log('Settings seeded!')
}

export const createAdminDoc = async (uid, name, email) => {
  await setDoc(doc(db, 'admins', uid), {
    adminName: name,
    email,
    role: 'admin',
    createdAt: serverTimestamp(),
  })
  console.log('Admin document created for UID:', uid)
}
