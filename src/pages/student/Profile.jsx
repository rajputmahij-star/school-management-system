import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getFeeRules, getEmployees } from '../../firebase/firestore'
import {
  formatDate, calculateAge, formatCurrency, getStudentStatus,
  getAcademicYear, calculateStudentFee,
} from '../../utils/helpers'
import ChangePasswordForm from '../../components/ui/ChangePasswordForm'

export default function StudentProfile() {
  const { userData } = useAuth()
  const [feeRules, setFeeRules] = useState([])
  const [classEducator, setClassEducator] = useState('')

  useEffect(() => {
    getFeeRules().then(setFeeRules).catch(console.error)
    // Find the educator assigned to this student's class
    if (userData?.className) {
      getEmployees().then((employees) => {
        const educator = employees.find(
          (e) => e.assignedClass === userData.className && !e.leaveDate
        )
        if (educator) setClassEducator(educator.employeeName)
      }).catch(console.error)
    }
  }, [userData?.className])

  if (!userData) return null

  const age      = calculateAge(userData.dob)
  const admYear  = getAcademicYear(userData.admissionDate)
  const { fee, bracket } = calculateStudentFee(feeRules, userData)
  const bracketLabel = bracket
    ? `${bracket.minAge}${bracket.maxAge !== '' && bracket.maxAge !== undefined ? `–${bracket.maxAge}` : '+'} yrs`
    : 'No matching rule'

  // reusable info tile
  const InfoTile = ({ label, value }) => (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value || 'N/A'}</p>
    </div>
  )

  // section heading
  const SectionHeading = ({ children }) => (
    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">{children}</p>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>

      <div className="card p-4 sm:p-6 space-y-6">

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700">
            {userData.photo ? (
              <img src={userData.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">
                {userData.studentName?.[0]}
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userData.studentName}</h2>
            <p className="text-sm text-gray-500">Class {userData.className}</p>
          </div>
        </div>

        {/* Fee summary highlight */}
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Current Age</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{age !== 'N/A' ? `${age} yrs` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Admission Year</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{admYear || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Fee Category</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{bracketLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Calculated Fee</p>
            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {fee > 0 ? formatCurrency(fee) : '—'}
            </p>
          </div>
        </div>

        {/* One-time fees strip */}
        {(userData.admissionFee > 0 || userData.depositFee > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userData.admissionFee > 0 && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Admission Fee</p>
                  <p className="text-xs text-gray-500 mt-0.5">One-time · collected at admission</p>
                </div>
                <p className="text-base font-bold text-blue-700 dark:text-blue-300">{formatCurrency(userData.admissionFee)}</p>
              </div>
            )}
            {userData.depositFee > 0 && (
              <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Deposit Fee</p>
                  <p className="text-xs text-gray-500 mt-0.5">Refundable on leaving</p>
                </div>
                <p className="text-base font-bold text-purple-700 dark:text-purple-300">{formatCurrency(userData.depositFee)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Basic Information ── */}
        <div>
          <SectionHeading>📋 Basic Information</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile label="Student ID"     value={userData.studentId} />
            <InfoTile label="Date of Birth"  value={formatDate(userData.dob)} />
            <InfoTile label="Gender"         value={userData.gender} />
            <InfoTile label="Nationality"    value={userData.nationality} />
            <InfoTile label="Place of Birth" value={userData.placeOfBirth} />
            <InfoTile label="Religion"       value={userData.religion} />
            <InfoTile label="Mother Tongue"  value={userData.motherTongue} />
            <InfoTile label="Aadhar Number"  value={userData.aadharNumber} />
            <InfoTile label="Class"          value={userData.className} />
            <InfoTile label="Class Educator" value={classEducator || userData.classEducator || userData.classTeacher} />
            <InfoTile label="GR Number"      value={userData.grNumber} />
            <InfoTile label="Date of Admission" value={formatDate(userData.admissionDate)} />
            <InfoTile label="Mode of Transport" value={userData.modeOfTransport} />
            <InfoTile label="Status"         value={getStudentStatus(userData.leaveDate)} />
          </div>
        </div>

        {/* ── Parent Information ── */}
        <div>
          <SectionHeading>👨‍👩‍👧 Parent Information</SectionHeading>

          {/* Father */}
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Father</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <InfoTile label="Father's Name"         value={userData.fatherName} />
            <InfoTile label="Qualification"         value={userData.fatherQualification} />
            <InfoTile label="Occupation"            value={userData.fatherOccupation} />
            <InfoTile label="Contact Number"        value={userData.fatherContact} />
            {userData.fatherOfficeAddress && (
              <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Office Address</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{userData.fatherOfficeAddress}</p>
              </div>
            )}
          </div>

          {/* Mother */}
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Mother</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <InfoTile label="Mother's Name"         value={userData.motherName} />
            <InfoTile label="Qualification"         value={userData.motherQualification} />
            <InfoTile label="Occupation"            value={userData.motherOccupation} />
            <InfoTile label="Contact Number"        value={userData.motherContact} />
            {userData.motherOfficeAddress && (
              <div className="sm:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium">Office Address</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{userData.motherOfficeAddress}</p>
              </div>
            )}
          </div>

          {/* Home address */}
          {userData.homeAddress && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium">Home Address (Family Residence)</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{userData.homeAddress}</p>
            </div>
          )}
        </div>

      </div>

      <ChangePasswordForm />
    </div>
  )
}
