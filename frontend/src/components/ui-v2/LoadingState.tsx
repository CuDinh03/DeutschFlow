import * as React from 'react'
import { cn } from '@/lib/utils'
import { SkeletonRow } from './SkeletonRow'

/** LoadingState — spinner or skeleton block (AI tools, players, lists). */
export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton'
  label?: string
  rows?: number
  className?: string
}

export function LoadingState({
  variant = 'spinner',
  label,
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-0', className)} role="status" aria-live="polite">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
        {label && <span className="sr-only">{label}</span>}
      </div>
    )
  }
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-[3px] border-ga-line border-t-ga-accent"
      />
      {label && <p className="ga-ui text-[13px] text-ga-muted">{label}</p>}
    </div>
  )
}
