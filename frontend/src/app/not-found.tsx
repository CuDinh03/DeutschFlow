'use client'

import '@/styles/galerie.css'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { GaLogo } from '@/components/ui-v2/GaLogo'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { useTracking } from '@/hooks/useTracking'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/**
 * Trang 404 chung (cả mã nghề lạ ở `/phong-van/[nghe]`), đồng bộ khung `PublicShell` v3.4.
 *
 * Chữ đọc từ `v2.error` ba thứ tiếng (`vi` / `en` / `de`), ghi sự kiện `client_route_not_found` về PostHog
 * và đưa người xem về đúng lối điều hướng chính thay vì nút "Quay lại" trống lịch sử.
 */
export default function NotFound() {
  const t = useTranslations('v2.error')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const { trackEvent } = useTracking()
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    const timer = setTimeout(() => {
      sent.current = true
      trackEvent('client_route_not_found', {
        path: window.location.pathname,
        referrer: document.referrer || 'direct',
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [trackEvent])

  return (
    <PublicShell stickyCta={false} mainClassName="flex items-center justify-center px-5 py-14 sm:py-20">
      <div className="w-full max-w-[540px] rounded-ga-xl border border-ga-border bg-ga-card p-7 shadow-ga-md sm:p-10">
        <div className="flex items-center justify-between gap-4 border-b border-ga-border pb-5">
          <GaLogo size={30} />
          <span className="rounded-ga-pill border border-ga-yellow bg-ga-yellow-soft px-3.5 py-1 font-ga-display text-ga-h3 font-medium text-ga-ink">
            404
          </span>
        </div>

        <p aria-hidden className="mt-6 font-ga-display text-ga-numeral-xl font-medium text-ga-ink">
          404
        </p>
        <div className="mt-2 space-y-2.5">
          <h1 className="font-ga-display text-ga-m-h2-m font-medium text-ga-ink">{t('notFoundTitle')}</h1>
          <p className="text-ga-body text-ga-muted">{t('notFoundDesc')}</p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
            <Link href={localizedHref(locale, '/')}>
              {t('notFoundHome')}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </GaBtn>
          <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
            <Link href={localizedHref(locale, '/phong-van')}>{t('notFoundOccupations')}</Link>
          </GaBtn>
        </div>

        {locale === 'vi' && (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ga-border pt-4 text-ga-small text-ga-muted">
            <Link href="/luyen-thi/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
              Luyện thi telc B1
            </Link>
            <span aria-hidden className="text-ga-faint">·</span>
            <Link href="/cam-nang/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
              Cẩm nang theo nghề
            </Link>
            <span aria-hidden className="text-ga-faint">·</span>
            <Link href="/chi-phi/" className="font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink">
              Chi phí
            </Link>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
