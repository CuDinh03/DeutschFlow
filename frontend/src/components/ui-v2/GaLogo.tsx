import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaLogo — official **myDeutschFlow** brand lockup for the v2 surface.
 *
 * Bauhaus D-mark (ink outline + red flow-arrow + yellow square) followed by the
 * "my Deutsch Flow" wordmark with "Flow" in brand red. This is a static,
 * dependency-free rendition of the canonical <DeutschFlowLogo> mark so it can
 * render in every sidebar / nav without pulling in framer-motion.
 *
 * Mark geometry + colours mirror src/components/ui/DeutschFlowLogo.tsx 1:1
 * (path, red polygon, yellow rect) — keep the two in sync if the brand changes.
 */
export interface GaLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Hide the wordmark, show the mark only (collapsed sidebar). */
  markOnly?: boolean
  /** Mark size in px; the wordmark scales with it. Default 28. */
  size?: number
}

// Brand wordmark is a geometric system sans (matches the canonical logo asset),
// not the Galerie editorial serif.
const WORDMARK_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function DfMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      {/* D-shape outline */}
      <path
        d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z"
        fill="none"
        stroke="var(--ga-ink)"
        strokeWidth="6"
        strokeLinejoin="miter"
      />
      {/* Red flow arrow */}
      <polygon points="52,38 74,50 52,62" fill="var(--ga-red)" />
      {/* Yellow Bauhaus square */}
      <rect x="24" y="45" width="9" height="9" fill="var(--ga-yellow)" />
    </svg>
  )
}

export function GaLogo({ markOnly = false, size = 28, className, ...props }: GaLogoProps) {
  const wordSize = Math.round(size * 0.64) // "Deutsch" / "Flow"
  const mySize = Math.round(size * 0.5) // "my"

  return (
    <span
      className={cn('inline-flex items-center gap-[10px]', className)}
      aria-label="myDeutschFlow"
      {...props}
    >
      <DfMark size={size} />
      {!markOnly && (
        <span
          className="inline-flex items-baseline leading-none"
          style={{ fontFamily: WORDMARK_FONT }}
          aria-hidden
        >
          <span
            style={{ fontSize: mySize, fontWeight: 300, letterSpacing: '0.04em', color: 'var(--ga-ink)' }}
          >
            my
          </span>
          <span
            style={{ fontSize: wordSize, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ga-ink)' }}
          >
            Deutsch
          </span>
          <span
            style={{ fontSize: wordSize, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ga-red)' }}
          >
            Flow
          </span>
        </span>
      )}
    </span>
  )
}
