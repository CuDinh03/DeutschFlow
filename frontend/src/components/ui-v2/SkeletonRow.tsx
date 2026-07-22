import * as React from 'react'
import { cn } from '@/lib/utils'

/** SkeletonRow — loading placeholder. Manifest: variants row|card, state shimmer. */
export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'row' | 'card'
}

export function SkeletonRow({ variant = 'row', className, ...props }: SkeletonRowProps) {
  if (variant === 'card') {
    return (
      <div
        className={cn('rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6', className)}
        aria-hidden
        {...props}
      >
        <div className="h-3 w-1/3 animate-pulse rounded-ga bg-ga-border" />
        <div className="mt-4 h-2.5 w-2/3 animate-pulse rounded-ga bg-ga-side-active" />
        <div className="mt-2.5 h-2.5 w-1/2 animate-pulse rounded-ga bg-ga-side-active" />
      </div>
    )
  }
  return (
    <div
      className={cn('flex items-center gap-4 border-b border-ga-line py-3.5', className)}
      aria-hidden
      {...props}
    >
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-ga-pill bg-ga-border" />
      <div className="h-2.5 flex-1 animate-pulse rounded-ga bg-ga-side-active" />
      <div className="h-2.5 w-16 animate-pulse rounded-ga bg-ga-side-active" />
    </div>
  )
}
