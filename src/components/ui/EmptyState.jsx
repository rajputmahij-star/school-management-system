import React from 'react'
import { HiInbox } from 'react-icons/hi'

export default function EmptyState({ icon: Icon = HiInbox, title = 'No data found', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
