'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { GaLogo, GaBtn } from '@/components/ui-v2'
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'
import { useTracking } from '@/hooks/useTracking'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref, publicHref } from '@/lib/publicLocale'
import { START_HREF } from './links'

/**
 * Header chung của trang công khai đã dịch (trang chủ, Về chúng tôi).
 *
 * Trên trang chủ các mục trỏ neo trong trang (`#interview`…); ở trang khác chúng trỏ về trang chủ
 * ĐÚNG ngôn ngữ đang xem (`/en/#interview`). "Về chúng tôi" là trang riêng, đánh dấu
 * `aria-current` khi đang ở đó. Trên trang `/phong-van` (đợt 2d), mục "Phỏng vấn theo nghề" trỏ về
 * trang tổng các nghề và được đánh dấu là trang hiện tại. "Cho trung tâm" trỏ trang trung tâm riêng
 * (đợt 3a: `/trung-tam/`, `/en/schools/`); ngôn ngữ chưa có bản (tiếng Đức) thì vẫn về neo trên trang chủ.
 */

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />

// [labelKey, anchor id] — nhãn đọc từ landing.nav.<labelKey>.
const NAV_ANCHORS = [
  ['interview', 'interview'],
  ['pathways', 'pathways'],
  ['exam', 'exam'],
  ['centers', 'centers'],
] as const

export function LandingHeader({ current = 'home' }: { current?: 'home' | 'about' | 'interview' | 'centers' }) {
  const t = useTranslations('v2.landing')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const homeHref = localizedHref(locale, '/')
  const aboutHref = localizedHref(locale, '/about')
  const anchor = (id: string) => (current === 'home' ? `#${id}` : `${homeHref}#${id}`)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const { trackEvent } = useTracking()
  const trackCta = (placement: string) => trackEvent('landing_cta_clicked', { placement })

  const interviewHref = localizedHref(locale, '/phong-van')
  const centersHref = publicHref(locale, '/trung-tam')
  const links = [
    ...NAV_ANCHORS.map(([key, id]) => {
      if (key === 'interview' && current === 'interview') return { key, href: interviewHref, active: true }
      if (key === 'centers' && centersHref) return { key, href: centersHref, active: current === 'centers' }
      return { key, href: anchor(id), active: false }
    }),
    { key: 'about', href: aboutHref, active: current === 'about' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-ga-border bg-[color-mix(in_srgb,var(--ga-bg)_92%,transparent)] backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-2 px-5 sm:px-8 md:h-[78px] xl:px-[60px]">
        <Link href={homeHref} aria-label="myDeutschFlow" className="shrink-0 transition-opacity hover:opacity-80">
          <GaLogo size={26} className="md:hidden" />
          <GaLogo className="hidden md:inline-flex" />
        </Link>
        <nav aria-label={t('nav.mainAria')} className="hidden gap-7 lg:flex xl:gap-9">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={`whitespace-nowrap text-ga-body font-medium transition-colors hover:text-ga-ink ${
                l.active ? 'border-b-2 border-ga-yellow text-ga-ink' : 'text-ga-muted'
              }`}
            >
              {t(`nav.${l.key}`)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
          <span className="hidden sm:inline-flex"><LanguageToggle /></span>
          <Link href="/v2/login" className="hidden text-ga-body font-semibold text-ga-ink hover:opacity-80 sm:block">
            {t('header.login')}
          </Link>
          {/* h-11 (44px) ở mọi bề ngang — mức tối thiểu 44pt của Apple HIG cho nút chuyển đổi chính. */}
          {/* Cỡ chữ đặt ở thẻ con: class `text-ga-*` đặt lên GaBtn bị tailwind-merge coi là MÀU chữ và
              xoá mất màu của biến thể ink (nút thành chữ đen trên nền đen). */}
          <GaBtn asChild variant="ink" size="lg" className="h-11 px-3.5 sm:px-6">
            <Link href={START_HREF} onClick={() => trackCta('header')}>
              <YellowSq />
              <span className="text-ga-small sm:hidden">{t('header.tryShort')}</span>
              <span className="hidden text-ga-body sm:inline">{t('header.tryFree')}</span>
            </Link>
          </GaBtn>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="ga-mobile-menu"
            aria-label={menuOpen ? t('header.closeMenu') : t('header.openMenu')}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-ga-border text-ga-ink lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.8" />
              ) : (
                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Overlay (absolute) so opening/closing never shifts the page — anchor jumps stay accurate. */}
      {menuOpen && (
        <div id="ga-mobile-menu" className="absolute inset-x-0 top-full border-y border-ga-border bg-ga-bg shadow-ga-panel lg:hidden">
          <div className="flex flex-col px-5 pb-5 sm:px-8">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.href}
                aria-current={l.active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className="border-b border-ga-border py-3.5 text-ga-body-lg font-medium text-ga-ink"
              >
                {t(`nav.${l.key}`)}
              </a>
            ))}
            <Link
              href="/v2/login"
              onClick={() => setMenuOpen(false)}
              className="border-b border-ga-border py-3.5 text-ga-body-lg font-semibold text-ga-ink sm:hidden"
            >
              {t('header.login')}
            </Link>
            <div className="flex items-center justify-between border-b border-ga-border py-3.5 sm:hidden">
              <LanguageToggle />
            </div>
            <GaBtn asChild variant="ink" size="lg" className="mt-5 w-full">
              <Link href={START_HREF} onClick={() => { trackCta('mobile_menu'); setMenuOpen(false) }}>
                <YellowSq />{t('header.tryFree')}
              </Link>
            </GaBtn>
          </div>
        </div>
      )}
    </header>
  )
}
