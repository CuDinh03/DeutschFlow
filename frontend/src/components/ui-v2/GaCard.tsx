import * as React from 'react'
import { cn } from '@/lib/utils'

/** GaCard — surface/panel (token cardPad 24px, radius, hover shadow optional). */
export interface GaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function GaCard({ className, hover = false, ...props }: GaCardProps) {
  return (
    <div
      className={cn(
        'rounded-ga border border-ga-line bg-ga-card',
        hover && 'transition-shadow duration-150 hover:shadow-ga-card-hover',
        className,
      )}
      {...props}
    />
  )
}

export function GaCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-start justify-between gap-4 p-4 pb-0 lg:flex-nowrap lg:p-6 lg:pb-0', className)}
      {...props}
    />
  )
}

export function GaCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-ga-display text-[20px] font-medium text-ga-ink', className)} {...props} />
  )
}

export function GaCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 lg:p-6', className)} {...props} />
}
