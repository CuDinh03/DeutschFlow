'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { GaLogo } from '@/components/ui-v2'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/** Chân trang chung của trang công khai đã dịch. "Về chúng tôi" trỏ đúng bản ngôn ngữ đang xem. */
export function LandingFooter() {
  const t = useTranslations('v2.landing')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const links: [string, string][] = [
    ['about', localizedHref(locale, '/about')],
    ['privacy', '/privacy'],
    ['terms', '/terms'],
    ['support', '/support'],
  ]
  return (
    <footer className="border-t border-ga-border bg-ga-bg">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between md:py-12 lg:px-[60px]">
        <GaLogo />
        <nav aria-label={t('footer.legalAria')} className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {links.map(([key, href]) => (
            <Link key={key} href={href} className="text-ga-body font-medium text-ga-muted transition-colors hover:text-ga-ink">
              {t(`footer.${key}`)}
            </Link>
          ))}
        </nav>
        <p className="text-ga-caption text-ga-faint">© {new Date().getFullYear()} myDeutschFlow</p>
      </div>
    </footer>
  )
}
