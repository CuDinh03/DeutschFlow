'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { GaCap } from '@/components/ui-v2'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import founderInk from '../../assets/landing/founder/founder-ink-square.webp'

/**
 * Dải "Vì sao có myDeutschFlow" trên trang chủ: ảnh thật của người làm sản phẩm, một câu trích,
 * và lối sang trang Về chúng tôi (câu chuyện đầy đủ). Ảnh đã tách nền, đặt trên nền mực với khối vàng.
 */
export function FounderBand() {
  const t = useTranslations('v2.landing.founder')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  return (
    <section className="bg-ga-ink text-ga-bg">
      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-16 md:py-[88px] lg:px-[60px]">
        <Image
          src={founderInk}
          alt={t('photoAlt')}
          sizes="(min-width: 768px) 380px, 100vw"
          className="block h-auto w-full max-w-[380px]"
        />
        <div>
          <GaCap className="mb-[18px] text-ga-yellow">{t('cap')}</GaCap>
          <blockquote className="font-ga-display text-ga-h1-m font-normal italic leading-[1.3] lg:text-ga-h1">
            “{t('quote')}”
          </blockquote>
          <p className="mt-6 text-ga-body">
            <strong className="font-semibold">{t('name')}</strong>
            <span className="text-ga-subtle"> · {t('role')}</span>
          </p>
          <Link
            href={localizedHref(locale, '/about')}
            className="mt-7 inline-flex min-h-11 items-center gap-2.5 bg-ga-yellow px-5 text-ga-body font-semibold text-ga-ink hover:opacity-90"
          >
            {t('link')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
