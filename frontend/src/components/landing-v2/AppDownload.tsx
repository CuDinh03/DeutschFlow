'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { useTracking } from '@/hooks/useTracking'
import { cn } from '@/lib/utils'
import { APP_STORE_URL } from './links'

/**
 * Lối tải ứng dụng iPhone chính thức (`id6785281013`) trên 15 trang công khai (v3.4).
 *
 * Đo riêng bằng `landing_app_store_clicked` kèm `placement` để tách khỏi phễu web `landing_cta_clicked`.
 * Chưa phát hành app Android nên chỉ ghi rõ: iPhone dùng App Store, Android dùng bản web (Sổ lời hứa).
 */

export type AppStorePlacement =
  | 'header'
  | 'mobile_menu'
  | 'sticky_bar'
  | 'hero'
  | 'app_band'
  | 'learn_block'
  | 'footer'
  | 'brand_page'
  | 'about_page'

function useAppStoreClick(placement: AppStorePlacement) {
  const { trackEvent } = useTracking()
  return React.useCallback(() => trackEvent('landing_app_store_clicked', { placement }), [trackEvent, placement])
}

/**
 * Thuộc tính chung của mọi link sang App Store: mở thẻ mới, không lộ `window.opener`. Báo "mở
 * trong thẻ mới" bằng chữ ẩn (`sr-only`) thay vì `aria-label` để giữ chữ hiển thị trong tên đọc được (WCAG 2.5.3).
 */
const EXTERNAL = { href: APP_STORE_URL, target: '_blank', rel: 'noopener noreferrer' } as const

/** Biểu tượng Apple đơn sắc dùng chung cho huy hiệu App Store (không phải icon trang trí, chỉ rõ nền tảng iOS). */
export function ApplePlatformMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d="M16.365 12.633c.024 2.662 2.336 3.548 2.362 3.56-.02.062-.369 1.264-1.218 2.504-.733 1.072-1.494 2.14-2.693 2.162-1.178.022-1.557-.699-2.905-.699-1.347 0-1.77.677-2.883.721-1.156.044-2.037-1.16-2.776-2.228-1.511-2.185-2.666-6.173-1.115-8.867.77-1.338 2.147-2.186 3.64-2.208 1.136-.022 2.208.765 2.905.765.696 0 2.003-.946 3.377-.807.575.024 2.189.232 3.225 1.749-.084.052-1.925 1.123-1.919 3.348ZM14.152 6.08c.616-.746 1.031-1.784.918-2.82-.888.036-1.963.592-2.6 1.338-.571.66-1.071 1.716-.936 2.732.991.077 2.002-.504 2.618-1.25Z" />
    </svg>
  )
}

/** Chip gọn `[Apple] App iOS` trên thanh điều hướng Desktop (`>= 1280px`). */
export function AppStoreHeaderPill({ className }: { className?: string }) {
  const tLanding = useTranslations('v2.landing')
  const onClick = useAppStoreClick('header')
  return (
    <a
      {...EXTERNAL}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-ga-pill border border-ga-border-strong bg-ga-surface-2 px-3 py-1.5 text-ga-caption font-semibold text-ga-ink transition-colors hover:bg-ga-yellow-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        className,
      )}
    >
      <ApplePlatformMark size={14} />
      <span>{tLanding('header.appIos')}</span>
      <span className="sr-only"> {tLanding('app.newTab')}</span>
    </a>
  )
}

/** Huy hiệu chuẩn mở App Store (`Tải miễn phí trên / App Store`) cho Hero, Footer, trang thương hiệu & giới thiệu. */
export function AppStoreBadge({
  placement,
  variant = 'dark',
  className,
}: {
  placement: AppStorePlacement
  variant?: 'dark' | 'light'
  className?: string
}) {
  const tLanding = useTranslations('v2.landing')
  const onClick = useAppStoreClick(placement)
  return (
    <a
      {...EXTERNAL}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center gap-2.5 rounded-ga-sm border px-4 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        variant === 'dark'
          ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
          : 'border-ga-border-strong bg-ga-ink text-white hover:opacity-90',
        className,
      )}
    >
      <ApplePlatformMark size={20} />
      <span className="flex flex-col leading-tight">
        <span className="text-ga-eyebrow font-medium normal-case tracking-normal text-white/75">
          {tLanding('footer.badgeTop')}
        </span>
        <span className="text-ga-body font-bold text-white">{tLanding('footer.badgeMain')}</span>
      </span>
      <span className="sr-only"> {tLanding('app.newTab')}</span>
    </a>
  )
}

/** Dải tối "Luyện phỏng vấn ngay trên điện thoại" — đặt sau khối lộ trình (nơi nhắc video trên app). */
export function AppDownloadBand() {
  const t = useTranslations('v2.landing.app')
  const points = t.raw('points') as string[]
  const onClick = useAppStoreClick('app_band')
  return (
    <section id="app" aria-labelledby="app-title" className="ga-public scroll-mt-20 bg-ga-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-2 md:items-center md:gap-14 md:py-16 lg:px-14">
        <div>
          <GaCap className="mb-4 text-ga-yellow">{t('cap')}</GaCap>
          <h2 id="app-title" className="mb-4 font-ga-display text-ga-m-h2-m font-semibold text-white lg:text-ga-m-h2">
            {t('title')}
          </h2>
          <p className="max-w-xl text-ga-body-lg text-white/75">{t('sub')}</p>
        </div>
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-ga-body text-white/90">
                <span aria-hidden className="mt-2 inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
                {point}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto sm:self-start">
              <a {...EXTERNAL} onClick={onClick}>
                <ApplePlatformMark size={17} />
                {t('button')}
                <span className="sr-only"> {t('newTab')}</span>
              </a>
            </GaBtn>
            <p className="text-ga-small text-white/70">{t('note')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Hàng App Store trong khối lộ trình: khối "Học nền tảng" và lối tải ứng dụng đặt cạnh nhau.
 * Đo riêng bằng vị trí `learn_block`.
 */
export function AppStoreLearnRow() {
  const t = useTranslations('v2.landing.app')
  const onClick = useAppStoreClick('learn_block')
  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-ga-border pt-6 sm:flex-row sm:items-center sm:gap-5">
      <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
        <a {...EXTERNAL} onClick={onClick}>
          <ApplePlatformMark size={16} className="text-ga-yellow" />
          {t('button')}
          <span className="sr-only"> {t('newTab')}</span>
        </a>
      </GaBtn>
      <p className="text-ga-small text-ga-muted">{t('note')}</p>
    </div>
  )
}

/** Link chữ nhỏ dưới CTA hero — phụ, không tranh nút chính "Học thử miễn phí". */
export function AppStoreHeroLink() {
  const t = useTranslations('v2.landing.app')
  const onClick = useAppStoreClick('hero')
  return (
    <a
      {...EXTERNAL}
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 self-start text-ga-small font-medium text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
    >
      <ApplePlatformMark size={14} />
      {t('heroLink')}
      <span className="sr-only"> {t('newTab')}</span>
    </a>
  )
}

/** Mục "Ứng dụng iPhone" ở chân trang (dùng chung toàn bộ 15 trang công khai). */
export function AppStoreFooterLink({ className }: { className?: string }) {
  const t = useTranslations('v2.landing.app')
  const onClick = useAppStoreClick('footer')
  return (
    <a {...EXTERNAL} onClick={onClick} className={className}>
      {t('footer')}
      <span className="sr-only"> {t('newTab')}</span>
    </a>
  )
}
