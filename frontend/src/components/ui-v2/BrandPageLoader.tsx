import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BrandPageLoaderProps {
  /** Dòng thông báo ngắn dưới biểu tượng xoay (tùy chọn). */
  label?: string
  /** Dòng phụ nhỏ bên dưới (tùy chọn). */
  sublabel?: string
  /**
   * `fullscreen`: phủ kính mờ toàn màn hình (`app/loading.tsx` hoặc khi đang nộp form dài).
   * `inline`: nằm gọn trong một khung thẻ (ví dụ ô chờ chấm bài `/free-grade/`).
   */
  mode?: 'fullscreen' | 'inline'
  className?: string
}

/**
 * BrandPageLoader — hiệu ứng xoay biểu tượng thương hiệu myDeutschFlow (v3.4).
 *
 * Chống trang trắng tinh khi chuyển route hoặc chờ xử lý bất đồng bộ (chấm bài viết, xác thực OTP):
 * - Vòng quỹ đạo ngoài xoay thuận chiều kim đồng hồ (cung vàng `--ga-brand-yellow` + cung đỏ `--ga-brand-red`).
 * - Vòng nét đứt trong xoay ngược chiều.
 * - Tâm là chữ `D` vát cạnh chính thức nhịp thở nhẹ, mũi tên đỏ `.df-flow-tri` đẩy nhẹ về phía trước.
 * - Tôn trọng `prefers-reduced-motion: reduce` (tự động tắt xoay qua CSS trong `galerie.css`).
 */
export function BrandPageLoader({
  label = 'myDeutschFlow',
  sublabel,
  mode = 'fullscreen',
  className,
}: BrandPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="brand-page-loader"
      className={cn(
        'ga-scope ga-public flex flex-col items-center justify-center text-center',
        mode === 'fullscreen'
          ? 'df-loader-backdrop fixed inset-0 z-50 min-h-screen px-6 py-10'
          : 'w-full rounded-ga-lg border border-ga-border bg-ga-card px-6 py-12 shadow-ga-sm',
        className,
      )}
    >
      <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="h-24 w-24 overflow-visible" fill="none">
          {/* Vòng nền mảnh */}
          <circle cx="50" cy="50" r="44" stroke="var(--ga-border)" strokeWidth="2.5" />
          {/* Quỹ đạo ngoài xoay thuận chiều */}
          <g className="df-orbit-cw">
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="var(--ga-brand-yellow)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="78 198"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="var(--ga-brand-red)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="38 238"
              strokeDashoffset="-126"
            />
          </g>
          {/* Quỹ đạo nét đứt trong xoay ngược chiều */}
          <g className="df-orbit-ccw">
            <circle
              cx="50"
              cy="50"
              r="36"
              stroke="var(--ga-brand-yellow)"
              strokeOpacity="0.55"
              strokeWidth="1.75"
              strokeDasharray="6 8"
            />
          </g>
          {/* Biểu tượng chữ D vát cạnh chính thức đặt ở tâm */}
          <g className="df-spinner-mark" transform="translate(50 50) scale(0.46) translate(-50 -50)">
            <path
              d="M 16 13 L 55 13 L 84 37 L 84 63 L 55 87 L 16 87 Z"
              fill="var(--ga-card)"
              stroke="var(--ga-brand-ink)"
              strokeWidth="11"
              strokeLinejoin="miter"
            />
            <rect x="27" y="43.5" width="13" height="13" rx="1.5" fill="var(--ga-brand-yellow)" />
            <polygon className="df-flow-tri" points="49,33 72,50 49,67" fill="var(--ga-brand-red)" />
          </g>
        </svg>
      </div>

      <p className="mt-4 text-ga-body font-semibold text-ga-ink">{label}</p>
      {sublabel && <p className="mt-1 max-w-xs text-ga-small text-ga-muted">{sublabel}</p>}

      <div className="mt-3.5 h-1 w-36 overflow-hidden rounded-ga-pill bg-ga-surface-3" aria-hidden="true">
        <div className="df-loader-bar h-full w-full rounded-ga-pill" />
      </div>
    </div>
  )
}
