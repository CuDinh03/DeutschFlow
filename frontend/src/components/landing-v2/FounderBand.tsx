'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import founderInk from '../../assets/landing/founder/founder-ink-square.webp'

/**
 * Dải "Vì sao có myDeutschFlow" trên trang chủ (v3.4):
 * - Ở màn điện thoại 390px: gom ảnh chân dung nhỏ gọn (96px bo tròn góc) nằm ngang cạnh tên tác giả
 *   để không nuốt nguyên 1 màn hình dọc chỉ cho tấm ảnh vuông lớn.
 * - Từ md trở lên: khôi phục bố cục 2 cột biên tập với khung ảnh lớn bên trái.
 */
export function FounderBand() {
  const t = useTranslations('v2.landing.founder')
  const raw = useLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  return (
    <section className="bg-ga-ink text-ga-bg">
      <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-16 md:py-20 lg:px-[60px]">
        <div className="flex items-center gap-4 md:block">
          <Image
            src={founderInk}
            alt={t('photoAlt')}
            sizes="(min-width: 768px) 340px, 96px"
            className="block h-24 w-24 shrink-0 rounded-ga-md object-cover md:h-auto md:w-full md:max-w-[340px] md:rounded-ga-lg"
          />
          <div className="md:hidden">
            <GaCap className="mb-1 text-ga-yellow">{t('cap')}</GaCap>
            <p className="text-ga-body font-semibold">{t('name')}</p>
            <p className="text-ga-caption text-ga-subtle">{t('role')}</p>
          </div>
        </div>
        <div>
          <GaCap className="mb-4 hidden text-ga-yellow md:block">{t('cap')}</GaCap>
          <blockquote className="font-ga-display text-ga-h1-m font-normal italic leading-[1.3] lg:text-ga-h1">
            “{t('quote')}”
          </blockquote>
          <p className="mt-5 hidden text-ga-body md:block">
            <strong className="font-semibold">{t('name')}</strong>
            <span className="text-ga-subtle"> · {t('role')}</span>
          </p>
          <Link
            href={localizedHref(locale, '/about')}
            className="mt-6 inline-flex min-h-11 items-center gap-2.5 rounded-ga-pill bg-ga-yellow px-5 text-ga-body font-semibold text-ga-ink transition-opacity hover:opacity-90"
          >
            {t('link')}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
