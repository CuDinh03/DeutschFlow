import * as React from 'react'
import { cn } from '@/lib/utils'
import { LandingFooter } from './LandingFooter'
import { LandingHeader, type PublicNavKey } from './LandingHeader'
import { MobileStickyCta } from './MobileStickyCta'

export interface PublicShellProps {
  children: React.ReactNode
  current?: PublicNavKey
  showLanguage?: boolean
  /** Bật thanh CTA dính đáy trên điện thoại sau khi cuộn qua Hero (`scrollY > 420`). */
  stickyCta?: false | 'b2c' | 'b2b'
  b2bHref?: string
  mainClassName?: string
  className?: string
}

/**
 * PublicShell — khung vỏ chuẩn dùng chung cho 15 nhóm trang công khai trước đăng nhập (v3.4).
 *
 * Bọc `.ga-scope.ga-public` để kích hoạt bảng token giấy kem ấm `bg-ga-bg`, vệt cọ vàng `.ga-hero-mark`,
 * dáng nút pill bo tròn và hoàn toàn cách ly với không gian sau đăng nhập (`/v2/student|teacher|org|admin`).
 */
export function PublicShell({
  children,
  current = 'none',
  showLanguage = true,
  stickyCta = false,
  b2bHref,
  mainClassName,
  className,
}: PublicShellProps) {
  return (
    <div className={cn('ga-scope ga-public flex min-h-screen flex-col overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink', className)}>
      <LandingHeader current={current} showLanguage={showLanguage} />
      <main className={cn('flex-1', mainClassName)}>{children}</main>
      <LandingFooter />
      {stickyCta && <MobileStickyCta mode={stickyCta} b2bHref={b2bHref} />}
    </div>
  )
}
