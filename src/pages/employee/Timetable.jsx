import React, { useState } from 'react'
import { HiTable } from 'react-icons/hi'
import { SCHOOL_CLASSES } from '../../utils/helpers'
import TimetableView from '../shared/TimetableView'
import { useAuth } from '../../context/AuthContext'

const TEACHING_ROLES = ['Educator', 'Special Educator', 'Assistant Educator', 'Co-ordinator', 'Principal']

export default function EducatorTimetable() {
  const { userData } = useAuth()
  const [selectedClass, setSelectedClass] = useState('')

  const isEducator = TEACHING_ROLES.includes(userData?.designation)

  // Block non-teaching staff from accessing this page at all
  if (!isEducator) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <HiTable className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Access Restricted</p>
        <p className="text-sm">Only teaching staff can view the timetable.</p>
      </div>
    )
  }
  const assignedClass = userData?.assignedClass || ''

  // Determine which classes this educator can edit
  // If they have an assigned class, they can ONLY edit that class
  // If no assigned class (e.g. Principal / Co-ordinator), they can edit any
  const hasClassRestriction = isEducator && assignedClass

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Educator Timetable</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasClassRestriction
            ? `You can only view and edit the timetable for your assigned class: ${assignedClass}`
            : 'View and edit class timetables'}
        </p>
      </div>

      {/* Class selector — restricted for assigned educators */}
      {hasClassRestriction ? (
        <div className="card p-4 no-print">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing timetable for your assigned class:
            <span className="ml-2 font-semibold text-gray-900 dark:text-white">{assignedClass}</span>
          </p>
        </div>
      ) : (
        <div className="card p-4 flex flex-wrap items-end gap-4 no-print">
          <div>
            <label className="label">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field w-52"
            >
              <option value="">-- Select Class --</option>
              {SCHOOL_CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <TimetableView
        className={hasClassRestriction ? assignedClass : selectedClass}
        canEdit={isEducator}
      />
    </div>
  )
}
