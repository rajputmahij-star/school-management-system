import React from 'react'
import { useAuth } from '../../context/AuthContext'
import TimetableView from '../shared/TimetableView'

export default function StudentTimetable() {
  const { userData } = useAuth()
  const className = userData?.className || ''

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetable</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {className ? `Class: ${className}` : 'Class not assigned'}
        </p>
      </div>
      <TimetableView className={className} canEdit={false} />
    </div>
  )
}
