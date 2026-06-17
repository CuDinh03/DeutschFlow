import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * GaBtn — Galerie 2.0 button. Manifest: variants primary|yellow|ghost|ink,
 * states default|hover|disabled|loading. Tokens only (no hardcoded color).
 */
const gaBtnVariants = cva(
  'ga-ui inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ga font-semibold transition-[background-color,opacity,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ga-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Primary CTA = role accent fill (70-admin-users .btn--navy = role accent, not yellow).
        primary: 'bg-ga-accent text-ga-accent-ink hover:opacity-90',
        yellow: 'bg-ga-yellow border border-ga-gold text-ga-ink hover:opacity-90',
        ink: 'bg-ga-ink text-ga-bg hover:opacity-90',
        ghost: 'border border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface',
      },
      size: {
        sm: 'h-8 px-3 text-[12.5px]',
        md: 'h-9 px-4 text-[13px]',
        lg: 'h-11 px-6 text-[14.5px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface GaBtnProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gaBtnVariants> {
  asChild?: boolean
  loading?: boolean
}

export function GaBtn({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: GaBtnProps) {
  const classes = cn(gaBtnVariants({ variant, size, className }))

  // asChild: Slot requires exactly ONE child — pass `children` through untouched.
  if (asChild) {
    return (
      <Slot data-slot="ga-btn" className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      data-slot="ga-btn"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
