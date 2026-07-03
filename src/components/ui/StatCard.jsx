import React from 'react'
import { cn } from '../../utils/helpers'

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, trend }) {
  const colors = {
    blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green:  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  }

  return (
    <div className="stat-card">
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>}
      </div>
      <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', colors[color])}>
        {Icon && <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}
      </div>
    </div>
  )
}
