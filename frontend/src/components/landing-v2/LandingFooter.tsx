'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { GaLogo } from '@/components/ui-v2'
import { AUSBILDUNG_CONTENT_REVIEWED, AUSBILDUNG_PAGE } from '@/lib/ausbildungGate'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref, publicHref } from '@/lib/publicLocale'
import { AppStoreBadge, AppStoreFooterLink } from './AppDownload'
import { FACEBOOK_URL, SUPPORT_EMAIL } from './links'

const COL_HEADING = 'mb-3.5 text-ga-eyebrow font-semibold uppercase tracking-widest text-ga-yellow'
const FOOTER_LINK = 'text-ga-body text-white/75 transition-colors hover:text-white'

/**
 * Chân trang chung 4 cột trên nền mực tối `bg-ga-ink` của 15 trang công khai (Warm Modern German EdTech v3.4).
 *
 * Bảo toàn quy chuẩn nhận diện: trên nền tối (`tone="dark"`), chữ `myDeutsch` màu trắng và `Flow`
 * luôn giữ nguyên màu đỏ `--ga-brand-red` kèm khẩu hiệu `LEARN GERMAN. FIND YOUR FLOW.`.
 */
export function LandingFooter() {
  const t = useTranslations('v2.landing')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE

  const interviewHref = localizedHref(locale, '/phong-van')
  const aboutHref = localizedHref(locale, '/about')
  const centersHref = publicHref(locale, '/trung-tam')
  const trainingHref = AUSBILDUNG_CONTENT_REVIEWED ? publicHref(locale, AUSBILDUNG_PAGE) : null

  const practiceLinks: [string, string][] = [
    [t('nav.interview'), interviewHref],
    ...(locale === 'vi'
      ? ([
          [t('footer.examTelc'), '/luyen-thi/telc-b1/'],
          [t('footer.freeGrade'), '/free-grade/'],
          [t('footer.pricing'), '/chi-phi/'],
        ] as [string, string][])
      : ([[t('nav.exam'), `${localizedHref(locale, '/')}#exam`]] as [string, string][])),
  ]

  const resourceLinks: [string, string][] = [
    ...(locale === 'vi'
      ? ([
          [t('footer.guide'), '/cam-nang/'],
          [t('footer.whatIs'), '/mydeutschflow-la-gi/'],
        ] as [string, string][])
      : []),
    ...(centersHref ? ([[t('nav.centers'), centersHref]] as [string, string][]) : []),
    ...(trainingHref ? ([[t('nav.training'), trainingHref]] as [string, string][]) : []),
  ]

  const legalLinks: [string, string][] = [
    [t('footer.about'), aboutHref],
    [t('footer.privacy'), '/privacy'],
    [t('footer.terms'), '/terms'],
    [t('footer.support'), '/support'],
  ]

  return (
    <footer className="ga-public border-t border-ga-border bg-ga-ink text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 md:py-16 lg:px-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Cột 1: Nhận diện thương hiệu Dark Mode + Tóm tắt trung thực */}
          <div className="lg:col-span-4">
            <GaLogo tone="dark" showTagline />
            <p className="mt-4 max-w-sm text-ga-small leading-relaxed text-white/75">{t('footer.summary')}</p>
          </div>

          {/* Cột 2: Luyện tập & Lộ trình */}
          <div className="lg:col-span-2">
            <h2 className={COL_HEADING}>{t('footer.colPractice')}</h2>
            <ul className="flex flex-col gap-2.5">
              {practiceLinks.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={FOOTER_LINK}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cột 3: Tài liệu & Trung tâm + Pháp lý */}
          <div className="lg:col-span-3">
            {resourceLinks.length > 0 && (
              <div className="mb-6">
                <h2 className={COL_HEADING}>{t('footer.colGuides')}</h2>
                <ul className="flex flex-col gap-2.5">
                  {resourceLinks.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className={FOOTER_LINK}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <h2 className={COL_HEADING}>{t('footer.colAbout')}</h2>
            <nav aria-label={t('footer.legalAria')} className="flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map(([label, href]) => (
                <Link key={href} href={href} className={FOOTER_LINK}>
                  {label}
                </Link>
              ))}
              <AppStoreFooterLink className={FOOTER_LINK} />
            </nav>
          </div>

          {/* Cột 4: Huy hiệu tải App Store iPhone + Liên hệ trực tiếp */}
          <div className="lg:col-span-3">
            <h2 className={COL_HEADING}>{t('footer.colApp')}</h2>
            <AppStoreBadge placement="footer" variant="dark" />
            <p className="mt-2.5 text-ga-caption leading-relaxed text-white/65">{t('footer.deviceNote')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-ga-small">
              <a href={`mailto:${SUPPORT_EMAIL}`} className={FOOTER_LINK}>
                {SUPPORT_EMAIL}
              </a>
              <span aria-hidden className="text-white/30">
                ·
              </span>
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                {t('footer.facebook')}
                <span className="sr-only"> {t('app.newTab')}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-ga-caption text-white/60">
          © {new Date().getFullYear()} myDeutschFlow
        </div>
      </div>
    </footer>
  )
}
