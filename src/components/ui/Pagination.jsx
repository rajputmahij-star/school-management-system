import React from 'react'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi'
import { cn } from '../../utils/helpers'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
      >
        <HiChevronLeft className="w-5 h-5" />
      </button>

      {pages[0] > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">1</button>
          {pages[0] > 2 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={cn(
            'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
            p === currentPage
              ? 'bg-primary-600 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          )}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800">{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
      >
        <HiChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
