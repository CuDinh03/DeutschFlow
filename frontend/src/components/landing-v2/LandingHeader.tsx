'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react'
import { GaLogo, GaBtn } from '@/components/ui-v2'
import { GaAppIconMark, GaBrandMark } from '@/components/ui-v2/GaLogo'
import { GaGlyphMark } from '@/components/ui-v2/GaGlyphMark'
import { LanguageToggle } from '@/components/ui-v2/LanguageToggle'
import { useTracking } from '@/hooks/useTracking'
import { AUSBILDUNG_CONTENT_REVIEWED, AUSBILDUNG_PAGE } from '@/lib/ausbildungGate'
import type { GlyphName } from '@/lib/galerieGlyphs'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref, publicHref } from '@/lib/publicLocale'
import { AppStoreHeaderPill } from './AppDownload'
import { APP_STORE_URL, START_HREF } from './links'

/**
 * Header chung của 15 nhóm trang công khai trước đăng nhập (Warm Modern German EdTech v3.4).
 *
 * - Desktop (`xl` >= 1280px): Logo `myDeutschFlow` (1 phần tử DOM co giãn thật, cấm `transform: scale()`) +
 *   thanh điều hướng chính + chip `[Apple] App iOS` + cụm ngôn ngữ `VI/EN/DE` + `Đăng nhập` + CTA vàng ánh kim.
 * - Mobile / Tablet (`< 1280px`): Mở `#ga-mobile-menu` dạng **Floating Sheet (`.md-sheet`)** bo góc `26px`
 *   trên lớp kính mờ `.md-backdrop`, gồm 4 tầng đồng bộ nhận diện:
 *   1. `.md-head-pill` (thương hiệu + `VI/EN/DE` + nút thu gọn tròn)
 *   2. `.md-nav-card` (các mục điều hướng gắn `GaGlyphMark` chuẩn, tô nền `bg-ga-yellow-tint` cho trang đang xem)
 *   3. `.md-quick-grid` (lưới tiện ích nhanh `2×2`)
 *   4. `.md-dock-dark` (dock tối `bg-ga-ink` chứa App Icon + nút mở App Store `id6785281013` + `Học thử miễn phí` / `Đăng nhập`)
 */

export type PublicNavKey =
  | 'home'
  | 'about'
  | 'interview'
  | 'exam'
  | 'pricing'
  | 'centers'
  | 'training'
  | 'guide'
  | 'none'

interface NavLinkItem {
  key: 'interview' | 'exam' | 'pricing' | 'guide' | 'centers' | 'training' | 'about'
  href: string
  active: boolean
  glyph: GlyphName
}

const NAV_ANCHORS = [
  ['interview', 'interview'],
  ['exam', 'exam'],
  ['centers', 'centers'],
] as const

export function LandingHeader({
  current = 'home',
  showLanguage = true,
}: {
  current?: PublicNavKey
  showLanguage?: boolean
}) {
  const t = useTranslations('v2.landing')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const homeHref = localizedHref(locale, '/')
  const aboutHref = localizedHref(locale, '/about')
  const anchor = (id: string) => (current === 'home' ? `#${id}` : `${homeHref}#${id}`)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const { trackEvent } = useTracking()
  const trackCta = (placement: string) => trackEvent('landing_cta_clicked', { placement })

  React.useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const interviewHref = localizedHref(locale, '/phong-van')
  const centersHref = publicHref(locale, '/trung-tam')
  const trainingHref = AUSBILDUNG_CONTENT_REVIEWED ? publicHref(locale, AUSBILDUNG_PAGE) : null

  const baseAnchors: NavLinkItem[] = NAV_ANCHORS.map(([key, id]) => {
    if (key === 'interview') {
      return { key, href: interviewHref, active: current === 'interview', glyph: 'phongvan' }
    }
    if (key === 'exam' && locale === 'vi') {
      return { key, href: '/luyen-thi/', active: current === 'exam', glyph: 'thithu' }
    }
    if (key === 'centers' && centersHref) {
      return { key, href: centersHref, active: current === 'centers', glyph: 'lophoc' }
    }
    const fallbackGlyph: GlyphName = key === 'exam' ? 'thithu' : 'lophoc'
    return { key, href: anchor(id), active: false, glyph: fallbackGlyph }
  })

  // Sắp xếp đúng thứ tự v3.4: Phỏng vấn -> Luyện thi -> (Chi phí, Cẩm nang ở bản vi) -> Cho trung tâm -> (Học nghề) -> Về chúng tôi.
  const links: NavLinkItem[] = [
    baseAnchors[0],
    baseAnchors[1],
    ...(locale === 'vi'
      ? ([
          { key: 'pricing', href: '/chi-phi/', active: current === 'pricing', glyph: 'goipro' },
          { key: 'guide', href: '/cam-nang/', active: current === 'guide', glyph: 'huongdan' },
        ] as NavLinkItem[])
      : []),
    baseAnchors[2],
    ...(trainingHref
      ? ([{ key: 'training', href: trainingHref, active: current === 'training', glyph: 'lernweg' }] as NavLinkItem[])
      : []),
    { key: 'about', href: aboutHref, active: current === 'about', glyph: 'hoso' },
  ]

  const quickLinks =
    locale === 'vi'
      ? [
          { label: t('header.quickFreeGrade'), href: '/free-grade/' },
          { label: t('header.quickWhatIs'), href: '/mydeutschflow-la-gi/' },
          { label: t('header.quickInterview'), href: interviewHref },
          { label: t('header.quickSupport'), href: '/support' },
        ]
      : [
          { label: t('header.quickInterview'), href: interviewHref },
          { label: t('header.quickSupport'), href: '/support' },
        ]

  return (
    <>
      <header
        className="ga-public sticky top-0 z-50 border-b border-ga-border backdrop-blur-md"
        style={{ backgroundColor: 'color-mix(in srgb, var(--ga-bg) 92%, transparent)' }}
      >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-8 md:h-20 xl:px-10">
        {/* Một logo đổi cỡ thật bằng biến CSS (26px mobile, 32px từ md) — cấm dùng transform: scale(). */}
        <Link
          href={homeHref}
          aria-label="myDeutschFlow"
          className="shrink-0 transition-opacity [--ga-logo-size:26px] hover:opacity-85 md:[--ga-logo-size:32px]"
        >
          <GaLogo />
        </Link>

        {/* Nav ngang từ xl (1280px); dưới xl mở Floating Sheet (#ga-mobile-menu) gọn đẹp trong 1 khung. */}
        <nav aria-label={t('nav.mainAria')} className="hidden items-center gap-5 xl:flex 2xl:gap-7">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              aria-current={l.active ? 'page' : undefined}
              className={`whitespace-nowrap py-1 text-ga-body font-medium transition-colors hover:text-ga-ink ${
                l.active ? 'border-b-2 border-ga-yellow font-semibold text-ga-ink' : 'text-ga-ink-2'
              }`}
            >
              {t(`nav.${l.key}`)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3.5">
          <AppStoreHeaderPill className="hidden xl:inline-flex" />
          {showLanguage && (
            <span className="hidden sm:inline-flex">
              <LanguageToggle />
            </span>
          )}
          <Link
            href="/v2/login"
            className="hidden whitespace-nowrap text-ga-body font-semibold text-ga-ink transition-opacity hover:opacity-80 sm:block"
          >
            {t('header.login')}
          </Link>
          {/* h-11 (44px) ở mọi bề ngang — mức chạm tối thiểu 44pt của Apple HIG. */}
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam h-11 px-3.5 sm:px-5">
            <Link href={START_HREF} onClick={() => trackCta('header')}>
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ga-pill border border-ga-border-strong bg-ga-card text-ga-ink transition-colors hover:bg-ga-surface-2 xl:hidden"
            >
              {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu thu gọn di động dạng Thẻ nổi (.md-sheet) trên kính mờ tối (.md-backdrop) — tách ngoài <header> để không bị backdrop-filter giam fixed. */}
      {menuOpen && (
        <div
          id="ga-mobile-menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false)
          }}
          className="ga-public md-backdrop fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto px-3 pb-5 pt-2.5 md:top-20 xl:hidden"
        >
          <div className="md-sheet md-sheet-in mx-auto max-w-md rounded-ga-sheet border border-ga-border-strong bg-ga-bg p-3 shadow-ga-lg">
            {/* 1. Thanh viên thuốc đầu menu (.md-head-pill) */}
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-ga-pill border border-ga-border bg-ga-card px-3.5 py-2 shadow-ga-sm">
              <span className="inline-flex items-center gap-2" aria-hidden="true">
                <GaBrandMark size={22} />
                <span className="text-ga-small tracking-tight text-ga-ink">
                  <span className="font-normal">my</span>
                  <span className="font-extrabold">Deutsch</span>
                  <span className="font-extrabold text-ga-red">Flow</span>
                </span>
              </span>
              <div className="flex items-center gap-2">
                {showLanguage && <LanguageToggle />}
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t('header.closeSheet')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ga-pill bg-ga-ink text-white transition-opacity hover:opacity-85"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>

            {/* 2. Thẻ điều hướng chính gắn icon Galerie (.md-nav-card) */}
            <div className="rounded-ga-md border border-ga-border bg-ga-card p-1.5 shadow-ga-sm">
              {links.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  aria-current={l.active ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-ga-sm px-2.5 py-2 transition-colors ${
                    l.active ? 'bg-ga-yellow-tint' : 'hover:bg-ga-surface-2'
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ga-sm border border-ga-border bg-ga-surface-2 text-ga-ink">
                    <GaGlyphMark name={l.glyph} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ga-body font-semibold text-ga-ink">{t(`nav.${l.key}`)}</span>
                    <span aria-hidden="true" className="block truncate text-ga-caption text-ga-muted">
                      {t(`nav.sub.${l.key}`)}
                    </span>
                  </span>
                  <ArrowRight size={15} aria-hidden className="shrink-0 text-ga-muted" />
                </a>
              ))}
            </div>

            {/* 3. Lưới tiện ích mở nhanh 2×2 (.md-quick-grid) */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between gap-1.5 rounded-ga-sm border border-ga-border bg-ga-card px-3 py-2 text-ga-caption font-semibold text-ga-ink shadow-ga-sm transition-colors hover:bg-ga-surface-2"
                >
                  <span className="truncate">{q.label}</span>
                  <ArrowRight size={13} aria-hidden className="shrink-0 text-ga-muted" />
                </Link>
              ))}
            </div>

            {/* 4. Dock tối bg-ga-ink chứa lối tải App Store + CTA Học thử / Đăng nhập (.md-dock-dark) */}
            <div className="mt-2.5 rounded-ga-md bg-ga-ink p-3 text-white shadow-ga-md">
              <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <GaAppIconMark size={36} className="rounded-ga-sm border border-white/15" />
                  <div className="min-w-0">
                    <p className="truncate text-ga-small font-semibold text-white">{t('header.dockTitle')}</p>
                    <p className="truncate text-ga-caption text-white/70">{t('header.dockSub')}</p>
                  </div>
                </div>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackEvent('landing_app_store_clicked', { placement: 'mobile_menu' })
                    setMenuOpen(false)
                  }}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-ga-pill border border-white/25 bg-white/10 px-3 py-1.5 text-ga-caption font-semibold text-white transition-colors hover:bg-white/20"
                >
                  {t('header.dockAppBtn')}
                  <ArrowUpRight size={13} aria-hidden />
                  <span className="sr-only"> {t('app.newTab')}</span>
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam h-11 px-3">
                  <Link
                    href={START_HREF}
                    onClick={() => {
                      trackCta('mobile_menu')
                      setMenuOpen(false)
                    }}
                  >
                    {t('header.tryFree')}
                  </Link>
                </GaBtn>
                <Link
                  href="/v2/login"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-ga-pill border border-white/25 bg-white/5 px-3 text-ga-body font-semibold text-white transition-colors hover:bg-white/15"
                >
                  {t('header.login')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
