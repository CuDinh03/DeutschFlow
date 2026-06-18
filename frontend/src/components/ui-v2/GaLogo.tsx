import * as React from 'react'
import { cn } from '@/lib/utils'

/** GaLogo — wordmark: yellow brand mark + Newsreader display wordmark. */
export interface GaLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Hide the wordmark text, show the mark only (collapsed sidebar). */
  markOnly?: boolean
}

export function GaLogo({ markOnly = false, className, ...props }: GaLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-ga bg-ga-yellow font-ga-display text-[16px] font-semibold text-ga-ink"
      >
        D
      </span>
      {!markOnly && (
        <span className="font-ga-display text-[18px] font-medium tracking-[-0.01em] text-ga-ink">
          DeutschFlow
        </span>
      )}
    </span>
  )
}
