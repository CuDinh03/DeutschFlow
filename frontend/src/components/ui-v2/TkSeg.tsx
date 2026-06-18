'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * TkSeg — segmented control (manifest TkSeg). Active = ink fill (design .sttabs.on).
 * Controlled: pass `value` + `onValueChange`.
 */
export interface TkSegOption<T extends string> {
  value: T
  label: React.ReactNode
}

export interface TkSegProps<T extends string> {
  options: TkSegOption<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  'aria-label'?: string
}

export function TkSeg<T extends string>({
  options,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel,
}: TkSegProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex overflow-hidden rounded-ga border border-ga-line bg-ga-card',
        '[&>button+button]:border-l [&>button+button]:border-ga-line',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'ga-ui px-3.5 py-2.5 text-[12.5px] font-semibold transition-colors',
              active ? 'bg-ga-accent text-ga-accent-ink' : 'text-ga-muted hover:text-ga-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
