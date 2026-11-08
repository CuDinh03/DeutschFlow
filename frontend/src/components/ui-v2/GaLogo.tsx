import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaLogo — the official myDeutschFlow brand logo, rendered as a STATIC SVG.
 *
 * It mirrors `components/ui/DeutschFlowLogo` (Bauhaus D-mark + red flow-arrow +
 * yellow square, "myDeutsch" + red "Flow") but without framer-motion, so it does
 * not pull that library into the perf-sensitive landing/app bundles (v2 is
 * otherwise framer-motion-free).
 */
export interface GaLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Hide the wordmark, show the mark only (collapsed sidebar). */
  markOnly?: boolean
  /** Mark height in px; the wordmark scales with it. */
  size?: number
}

const BRAND_RED = '#DA291C'

/**
 * Cỡ thật = biến CSS `--ga-logo-size` nếu phần tử cha đặt, không thì `size`. Nhờ vậy một logo đổi cỡ
 * theo breakpoint (`[--ga-logo-size:26px] md:[--ga-logo-size:34px]`) thay vì vẽ hai logo rồi ẩn một
 * cái — hai bản làm text thô của trang thành "myDeutschFlowmyDeutschFlow" (A2, 08/11/2026).
 */
const logoSize = (size: number) => `var(--ga-logo-size, ${size}px)`

function BrandMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className="shrink-0 text-ga-ink"
      style={{ width: logoSize(size), height: logoSize(size) }}
    >
      <path
        d="M 20 18 L 20 82 L 52 82 L 74 62 L 74 38 L 52 18 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="miter"
      />
      <polygon points="52,38 74,50 52,62" fill={BRAND_RED} />
      <rect x="24" y="45" width="9" height="9" fill="#FFCD00" />
    </svg>
  )
}

export function GaLogo({ markOnly = false, size = 34, className, ...props }: GaLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <BrandMark size={size} />
      {!markOnly && (
        <span
          className="leading-none text-ga-ink"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: `calc(${logoSize(size)} * 0.47)` }}
        >
          <span style={{ fontWeight: 300, letterSpacing: '0.02em' }}>my</span>
          <span style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Deutsch</span>
          <span style={{ fontWeight: 700, letterSpacing: '-0.02em', color: BRAND_RED }}>Flow</span>
        </span>
      )}
    </span>
  )
}
