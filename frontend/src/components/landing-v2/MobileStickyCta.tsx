'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2'
import { useTracking } from '@/hooks/useTracking'
import { ApplePlatformMark } from './AppDownload'
import { APP_STORE_URL, START_HREF } from './links'

/**
 * Thanh CTA dính đáy thông minh trên điện thoại (`< 768px`, v3.4):
 * - Chỉ xuất hiện sau khi người dùng đã cuộn qua vùng Hero (`window.scrollY > 420`) để không che nút chính ở màn đầu.
 * - B2C (`mode="b2c"`): `[Học thử miễn phí →]` + nút gọn `[Apple · Tải iOS]` mở App Store `id6785281013`.
 * - B2B (`mode="b2b"`): 1 nút toàn chiều ngang `[Đặt lịch demo 20 phút →]` nhảy xuống `#dat-lich` (không đẩy khách trung tâm vào phễu học viên).
 */
export function MobileStickyCta({
  mode = 'b2c',
  b2bHref = '#dat-lich',
}: {
  mode?: 'b2c' | 'b2b'
  b2bHref?: string
}) {
  const t = useTranslations('v2.landing')
  const { trackEvent } = useTracking()
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div
      data-testid="mobile-sticky-cta"
      className="ga-public fixed inset-x-0 bottom-0 z-40 border-t border-ga-border-strong px-3 py-2.5 shadow-ga-lg backdrop-blur-md md:hidden"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--ga-bg) 94%, transparent)',
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
      }}
    >
      {mode === 'b2b' ? (
        <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam h-11 w-full">
          <a href={b2bHref} onClick={() => trackEvent('landing_b2b_sticky_clicked')}>
            {t('stickyCta.demoB2b')}
            <ArrowRight size={16} aria-hidden />
          </a>
        </GaBtn>
      ) : (
        <div className="mx-auto flex max-w-md items-center gap-2">
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam h-11 min-w-0 flex-1 px-4">
            <Link href={START_HREF} onClick={() => trackEvent('landing_cta_clicked', { placement: 'sticky_bar' })}>
              <span className="truncate">{t('stickyCta.tryFree')}</span>
              <ArrowRight size={15} aria-hidden />
            </Link>
          </GaBtn>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('landing_app_store_clicked', { placement: 'sticky_bar' })}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-ga-pill bg-ga-ink px-3.5 text-ga-caption font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ApplePlatformMark size={14} />
            <span>{t('stickyCta.iosShort')}</span>
            <span className="sr-only"> {t('app.newTab')}</span>
          </a>
        </div>
      )}
    </div>
  )
}
