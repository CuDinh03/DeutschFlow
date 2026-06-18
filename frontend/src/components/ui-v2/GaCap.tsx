import * as React from 'react'
import { cn } from '@/lib/utils'

/** GaCap — uppercase eyebrow/caption (tokens.typography.scale.cap). */
export function GaCap({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted',
        className,
      )}
      {...props}
    />
  )
}
