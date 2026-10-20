import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { AboutStory } from '@/components/landing-v2/AboutStory'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/**
 * Về chúng tôi — `/about/`, `/en/about/`, `/de/about/` (làm mới hình ảnh 19/10/2026).
 *
 * Trước đây trang viết cứng tiếng Việt và chỉ có lối vào ở chân trang. Nay chữ đọc từ catalog
 * `v2.landing.about` ba thứ tiếng nên `/about` nằm trong PUBLIC_LOCALIZED_PATHS, và có mục riêng
 * trên menu (LandingHeader). `force-dynamic` như trang chủ: ngôn ngữ đến từ header middleware gắn.
 */
export const dynamic = 'force-dynamic'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

export async function generateMetadata(): Promise<Metadata> {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.about.meta')
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: localizedHref(locale, '/about'),
      languages: hreflangAlternates('/about'),
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: OG_LOCALE[locale],
      url: localizedHref(locale, '/about'),
      siteName: 'myDeutschFlow',
      images: ['/icon.svg'],
    },
  }
}

export default function AboutPage() {
  return (
    <div className="ga-scope">
      <AboutStory />
    </div>
  )
}
