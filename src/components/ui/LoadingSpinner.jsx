import React from 'react'
import { cn } from '../../utils/helpers'

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div
      className={cn(
        'rounded-full border-primary-200 border-t-primary-600 animate-spin',
        sizes[size],
        className
      )}
    />
  )
}
