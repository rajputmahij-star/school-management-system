import React, { useState } from 'react'
import { SCHOOL_CLASSES } from '../../utils/helpers'
import TimetableView from '../shared/TimetableView'

export default function AdminTimetable() {
  const [selectedClass, setSelectedClass] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timetable</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and edit class timetables</p>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-4">
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

      {/* canEdit=true — admin can view and edit */}
      <TimetableView className={selectedClass} canEdit={true} />
    </div>
  )
}
