'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { useTracking } from '@/hooks/useTracking'
import { APP_STORE_URL } from './links'

/**
 * Lối tải ứng dụng iPhone trên trang chủ (26/10/2026, cùng đợt A tốc độ trang chủ).
 *
 * Trước đó trang chủ không có chỗ nào nhắc tới app iOS dù app đã lên App Store từ build 17 — khách
 * vào bằng điện thoại (phần lớn) không biết có app, trong khi video bài học CHỈ có trên app.
 *
 * Đo riêng bằng `landing_app_store_clicked` (không trộn vào `landing_cta_clicked`): đó là phễu
 * onboarding trên web, còn bấm sang App Store là rời phễu web. Ghi kèm vị trí như CTA phễu.
 *
 * Chưa có bản Android nên KHÔNG hứa gì về Android (sổ lời hứa).
 */

type Placement = 'hero' | 'app_band' | 'footer'

function useAppStoreClick(placement: Placement) {
  const { trackEvent } = useTracking()
  return React.useCallback(() => trackEvent('landing_app_store_clicked', { placement }), [trackEvent, placement])
}

/**
 * Thuộc tính chung của mọi link sang App Store: mở thẻ mới, không lộ `window.opener`. Báo "mở
 * trong thẻ mới" bằng chữ ẩn (`sr-only`) thay vì `aria-label`: tên đọc được phải CHỨA chữ đang
 * hiện (WCAG 2.5.3) để người dùng điều khiển bằng giọng nói gọi đúng link.
 */
const EXTERNAL = { href: APP_STORE_URL, target: '_blank', rel: 'noopener noreferrer' } as const

/** Dải tối "Luyện phỏng vấn ngay trên điện thoại" — đặt sau khối lộ trình (nơi nhắc video trên app). */
export function AppDownloadBand() {
  const t = useTranslations('v2.landing.app')
  const points = t.raw('points') as string[]
  const onClick = useAppStoreClick('app_band')
  return (
    <section id="app" aria-labelledby="app-title" className="scroll-mt-[78px] bg-ga-ink text-ga-bg">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-[60px] md:py-[72px] lg:px-[60px]">
        <div>
          <GaCap className="mb-[18px] text-ga-yellow">{t('cap')}</GaCap>
          <h2 id="app-title" className="mb-4 font-ga-display text-ga-h1-m font-medium text-ga-bg lg:text-ga-display">
            {t('title')}
          </h2>
          <p className="max-w-[560px] text-ga-body-lg text-ga-subtle">{t('sub')}</p>
        </div>
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-ga-body text-ga-bg">
                <span aria-hidden className="mt-[7px] inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
                {point}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <GaBtn asChild variant="yellow" size="lg" className="w-full sm:w-auto sm:self-start">
              <a {...EXTERNAL} onClick={onClick}>
                <span aria-hidden className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-ink" />
                {t('button')}
                <span className="sr-only"> {t('newTab')}</span>
              </a>
            </GaBtn>
            <p className="text-ga-small text-ga-subtle">{t('note')}</p>
          </div>
        </div>
      </div>
    </section>
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
      className="inline-flex min-h-11 items-center self-start text-ga-small font-medium text-ga-ink underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
    >
      {t('heroLink')}
      <span className="sr-only"> {t('newTab')}</span>
    </a>
  )
}

/** Mục "Ứng dụng iPhone" ở chân trang (dùng chung trang chủ và Về chúng tôi). */
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
