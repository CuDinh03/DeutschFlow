import * as React from 'react'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'

/** EmptyState — empty list/screen + optional CTA. Manifest: variants invite|neutral. */
export interface EmptyStateProps {
  variant?: 'invite' | 'neutral'
  icon?: string
  title: string
  description?: string
  /** CTA slot (e.g. a <GaBtn>). */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  variant = 'neutral',
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center lg:px-6 lg:py-14',
        variant === 'invite' && 'rounded-ga border border-dashed border-ga-line bg-ga-card',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-ga-pill',
          variant === 'invite' ? 'bg-ga-accent-soft text-ga-accent' : 'bg-ga-side-active text-ga-subtle',
        )}
      >
        <GaIcon name={icon} size={24} />
      </span>
      <div className="space-y-1">
        <p className="font-ga-display text-[18px] font-medium text-ga-ink">{title}</p>
        {description && (
          <p className="ga-ui mx-auto max-w-sm text-[13px] text-ga-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
