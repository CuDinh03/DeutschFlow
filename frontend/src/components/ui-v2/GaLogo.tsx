import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaLogo — biểu tượng thương hiệu chính thức myDeutschFlow chuẩn v3.4 (14/11/2026).
 *
 * Quy chuẩn bất biến (`docs/HE_THONG_THIET_KE_TRANG_CONG_KHAI_V3.md` §2):
 * - Chữ `D` vát cạnh hướng phải (`strokeWidth="11"`), ô vuông điểm tựa vàng `--ga-brand-yellow`,
 *   mũi tên tam giác dòng chảy đỏ `--ga-brand-red`.
 * - Tên thương hiệu viết liền một từ `myDeutschFlow`:
 *   `my` (400) + `Deutsch` (800) đổi theo nền sáng/tối; `Flow` (800) LUÔN LUÔN màu đỏ `--ga-brand-red`
 *   trên cả nền sáng lẫn nền tối (Dark Mode).
 * - Không kéo `framer-motion`; dùng biến CSS `--ga-logo-size` để co giãn bằng MỘT phần tử DOM duy nhất
 *   (tránh lặp chuỗi text thô `myDeutschFlowmyDeutschFlow` ở bài kiểm a11y/SEO).
 */
export interface GaLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Ẩn chữ, chỉ hiện biểu tượng chữ D (sidebar thu gọn). */
  markOnly?: boolean
  /** Chiều cao biểu tượng (px); cỡ chữ tự tỷ lệ theo. Có thể ghi đè bằng CSS `--ga-logo-size`. */
  size?: number
  /** `light` = chữ mực trên nền sáng (mặc định); `dark` = chữ trắng trên nền mực tối, `Flow` vẫn đỏ. */
  tone?: 'light' | 'dark'
  /** Hiện dòng khẩu hiệu `LEARN GERMAN. FIND YOUR FLOW.` bên dưới tên thương hiệu (Footer / Brand board). */
  showTagline?: boolean
}

const logoSize = (size: number) => `var(--ga-logo-size, ${size}px)`

export function GaBrandMark({
  size = 34,
  tone = 'light',
  className,
}: {
  size?: number
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', tone === 'dark' ? 'text-white' : 'text-ga-ink', className)}
      style={{ width: logoSize(size), height: logoSize(size) }}
    >
      <path
        d="M 16 13 L 55 13 L 84 37 L 84 63 L 55 87 L 16 87 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinejoin="miter"
      />
      <rect x="27" y="43.5" width="13" height="13" rx="1.5" fill="var(--ga-brand-yellow)" />
      <polygon points="49,33 72,50 49,67" fill="var(--ga-brand-red)" />
    </svg>
  )
}

/** Biểu tượng App Icon nền mực bo góc (dùng cho dock tải ứng dụng iPhone trên menu mobile & footer). */
export function GaAppIconMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect width="100" height="100" rx="22" fill="var(--ga-brand-ink)" />
      <path
        d="M 22 19 L 55 19 L 80 39 L 80 61 L 55 81 L 22 81 Z"
        stroke="white"
        strokeWidth="9.5"
        strokeLinejoin="miter"
      />
      <rect x="31" y="44.5" width="11" height="11" rx="1.5" fill="var(--ga-brand-yellow)" />
      <polygon points="50,36 70,50 50,64" fill="var(--ga-brand-red)" />
    </svg>
  )
}

export function GaLogo({
  markOnly = false,
  size = 34,
  tone = 'light',
  showTagline = false,
  className,
  ...props
}: GaLogoProps) {
  const inkClass = tone === 'dark' ? 'text-white' : 'text-ga-ink'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} {...props}>
      <GaBrandMark size={size} tone={tone} />
      {!markOnly && (
        <span className="inline-flex flex-col">
          <span
            className={cn('leading-none', inkClass)}
            style={{
              fontFamily: 'var(--ga-ui, system-ui, -apple-system, sans-serif)',
              fontSize: `calc(${logoSize(size)} * 0.54)`,
              letterSpacing: '-0.025em',
            }}
          >
            <span style={{ fontWeight: 400 }}>my</span>
            <span style={{ fontWeight: 800 }}>Deutsch</span>
            <span style={{ fontWeight: 800, color: 'var(--ga-brand-red)' }}>Flow</span>
          </span>
          {showTagline && (
            <span
              aria-hidden="true"
              className={cn('mt-1 uppercase', tone === 'dark' ? 'text-white/70' : 'text-ga-muted')}
              style={{
                fontFamily: 'var(--ga-ui, system-ui, sans-serif)',
                fontSize: '9.5px',
                fontWeight: 600,
                letterSpacing: '0.2em',
              }}
            >
              LEARN GERMAN. FIND YOUR FLOW.
            </span>
          )}
        </span>
      )}
    </span>
  )
}
