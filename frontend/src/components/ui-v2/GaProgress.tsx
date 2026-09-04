import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaProgress — progress bar học tập (DS §8.2, consumer Wave 1–2: ContinueLearning, Journey,
 * Lesson shell). Track = surface 2, fill = `--ga-progress` (accent theo role).
 * Chuyển động bằng `transform: scaleX` (compositor-friendly, DS §7) với duration token 400ms;
 * reduced-motion tắt transition. Giá trị luôn có thể đọc được ngoài màu: `aria-valuenow` +
 * (tuỳ chọn) nhãn % text qua `showValue`.
 */
export interface GaProgressProps {
  /** 0..max */
  value: number
  max?: number
  /** Accessible name — bắt buộc nếu không có nhãn text bên cạnh. */
  label?: string
  /** Hiện nhãn % text cạnh thanh (state không truyền chỉ bằng màu). */
  showValue?: boolean
  className?: string
}

export function GaProgress({ value, max = 100, label, showValue = false, className }: GaProgressProps) {
  const clamped = Math.max(0, Math.min(max, value))
  const pct = max > 0 ? (clamped / max) * 100 : 0
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(clamped)}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-ga-pill bg-ga-side-active"
      >
        <div
          className="h-full w-full origin-left rounded-ga-pill bg-ga-progress transition-transform duration-ga-slow ease-ga-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      {showValue && (
        <span className="shrink-0 text-ga-caption font-semibold tabular-nums text-ga-muted">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
