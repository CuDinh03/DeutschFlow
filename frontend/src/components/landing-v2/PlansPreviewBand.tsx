'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { PLANS } from '@/data/chiPhiPage'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale } from '@/lib/publicLocale'
import { AppStoreHeroLink } from './AppDownload'
import { APP_STORE_URL, START_HREF } from './links'

/**
 * Băng xem nhanh các gói học phí B2C trên trang chủ (v3.4):
 * - Đọc trực tiếp nguồn đơn nhất `PLANS` từ `@/data/chiPhiPage` (0 lệch số liệu với `/chi-phi/`).
 * - Ở màn điện thoại 390px: cuộn ngang `mob-snap-rail` và đưa gói chính `Pro 2 tháng · 399.000₫`
 *   lên đầu băng (`-order-1 md:order-none`) để người học thấy ngay lựa chọn tối ưu mà trang không bị dài.
 * - Ở bản EN/DE (trang `/chi-phi/` hiện chỉ tiếng Việt): hiển thị thẻ tóm tắt dùng thử 7 ngày Pro minh bạch.
 */
export function PlansPreviewBand({
  onStartClick,
  ctaStartLabel,
}: {
  onStartClick: () => void
  ctaStartLabel: string
}) {
  const t = useTranslations('v2.landing.plansBand')
  const rawLocale = useLocale()
  const locale = isPublicLocale(rawLocale) ? rawLocale : DEFAULT_PUBLIC_LOCALE

  return (
    <section id="plans-preview" className="scroll-mt-20 border-t border-ga-border">
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 md:py-[72px] lg:px-[60px]">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[640px]">
            <GaCap className="mb-3">{t('cap')}</GaCap>
            <h2 className="font-ga-display text-ga-h1-m font-medium tracking-[-0.015em] text-ga-ink lg:text-ga-display">
              {t('title')}
            </h2>
            <p className="mt-3 text-ga-body-lg text-ga-muted">{t('sub')}</p>
          </div>
          {locale === 'vi' && (
            <Link
              href="/chi-phi/"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-ga-pill border border-ga-border-strong bg-ga-card px-4 text-ga-small font-semibold text-ga-ink transition-colors hover:border-ga-ink md:self-auto"
            >
              {t('detailLink')}
              <ArrowRight size={15} aria-hidden />
            </Link>
          )}
        </div>

        {locale === 'vi' ? (
          <div className="mob-snap-rail -mx-5 flex gap-4 px-5 pb-2 sm:mx-0 sm:px-0 md:grid md:grid-cols-2 md:pb-0 xl:grid-cols-4">
            {PLANS.map((plan) => {
              const isMain = plan.id === 'pro-2m'
              const isExternal = plan.cta === 'appStore'
              return (
                <article
                  key={plan.id}
                  className={`flex w-[286px] shrink-0 flex-col rounded-ga-lg border p-5 transition-shadow md:w-auto ${
                    isMain
                      ? '-order-1 border-ga-ink bg-ga-ink text-ga-bg shadow-ga-lg md:order-none'
                      : 'border-ga-border bg-ga-card text-ga-ink shadow-ga-sm'
                  }`}
                >
                  <div className="flex min-h-7 items-center justify-between gap-2">
                    <h3 className="text-ga-h3 font-semibold">{plan.name}</h3>
                    {plan.badge && (
                      <span className="rounded-ga-pill bg-ga-yellow px-2.5 py-0.5 text-ga-caption font-bold text-ga-ink">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-ga-display text-ga-numeral-m">{plan.price}</span>
                    {plan.period && (
                      <span className={`text-ga-small ${isMain ? 'text-ga-subtle' : 'text-ga-muted'}`}>
                        {plan.period}
                      </span>
                    )}
                  </p>
                  {plan.perMonthNote && (
                    <p className={`mt-1.5 text-ga-caption ${isMain ? 'text-ga-subtle' : 'text-ga-muted'}`}>
                      {plan.perMonthNote}
                    </p>
                  )}
                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-ga-small">
                    {plan.features.slice(0, 3).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-ga-pill ${
                            isMain ? 'bg-ga-yellow' : 'bg-ga-ink'
                          }`}
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <GaBtn
                      asChild
                      variant={isMain ? 'yellow' : 'ghost'}
                      size="md"
                      className={`min-h-11 w-full ${isMain ? 'ga-btn-gleam' : ''}`}
                    >
                      {isExternal ? (
                        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                          {plan.ctaLabel}
                          <span className="sr-only"> (App Store)</span>
                        </a>
                      ) : (
                        <Link href={START_HREF} onClick={onStartClick}>
                          {plan.ctaLabel}
                        </Link>
                      )}
                    </GaBtn>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-ga-lg border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex flex-wrap items-center gap-4">
              <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
                <Link href={START_HREF} onClick={onStartClick}>
                  {ctaStartLabel}
                </Link>
              </GaBtn>
              <AppStoreHeroLink />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
