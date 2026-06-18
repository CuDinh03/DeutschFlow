import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * TkBadge — status label. Manifest: variants soft|solid, state = status colors.
 * `tone` maps to the token status/accent family.
 */
const badgeVariants = cva(
  'ga-ui inline-flex items-center gap-1 rounded-ga-pill px-2 py-0.5 text-[11px] font-semibold leading-none',
  {
    variants: {
      variant: { soft: '', solid: 'text-white' },
      tone: {
        neutral: '',
        green: '',
        red: '',
        yellow: '',
        blue: '',
        violet: '',
        teal: '',
        navy: '',
      },
    },
    compoundVariants: [
      { variant: 'soft', tone: 'neutral', class: 'bg-ga-side-active text-ga-muted' },
      { variant: 'soft', tone: 'green', class: 'bg-ga-green-soft text-ga-green' },
      { variant: 'soft', tone: 'red', class: 'bg-ga-red-soft text-ga-red' },
      { variant: 'soft', tone: 'yellow', class: 'bg-ga-yellow-soft text-ga-gold' },
      { variant: 'soft', tone: 'blue', class: 'bg-ga-blue-soft text-ga-blue' },
      { variant: 'soft', tone: 'violet', class: 'bg-ga-violet-soft text-ga-violet' },
      { variant: 'soft', tone: 'teal', class: 'bg-ga-teal-soft text-ga-teal' },
      { variant: 'soft', tone: 'navy', class: 'bg-ga-navy-soft text-ga-navy' },
      { variant: 'solid', tone: 'neutral', class: 'bg-ga-ink' },
      { variant: 'solid', tone: 'green', class: 'bg-ga-green' },
      { variant: 'solid', tone: 'red', class: 'bg-ga-red' },
      { variant: 'solid', tone: 'yellow', class: 'bg-ga-yellow !text-ga-ink' },
      { variant: 'solid', tone: 'blue', class: 'bg-ga-blue' },
      { variant: 'solid', tone: 'violet', class: 'bg-ga-violet' },
      { variant: 'solid', tone: 'teal', class: 'bg-ga-teal' },
      { variant: 'solid', tone: 'navy', class: 'bg-ga-navy' },
    ],
    defaultVariants: { variant: 'soft', tone: 'neutral' },
  },
)

const DOT_TONE: Record<string, string> = {
  green: 'bg-ga-green',
  red: 'bg-ga-red',
  yellow: 'bg-ga-gold',
  blue: 'bg-ga-blue',
  violet: 'bg-ga-violet',
  teal: 'bg-ga-teal',
  navy: 'bg-ga-navy',
  neutral: 'bg-ga-muted',
}

export interface TkBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading status dot (70-admin-users: active/suspended badges). */
  dot?: boolean
}

export function TkBadge({ className, variant, tone, dot = false, children, ...props }: TkBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, tone, className }))} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', DOT_TONE[tone ?? 'neutral'] ?? 'bg-ga-muted')}
        />
      )}
      {children}
    </span>
  )
}
