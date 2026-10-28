import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE } from '@/lib/siteUrl'
import { getLocale, getTranslations } from 'next-intl/server'
import { OccupationIndex } from '@/components/landing-v2/OccupationPages'
import { fetchOccupations } from '@/lib/occupationServer'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/**
 * Phỏng vấn theo nghề, trang tổng — `/phong-van/`, `/en/phong-van/`, `/de/phong-van/` (đợt 2d A+B+E).
 * `force-dynamic` như trang chủ: ngôn ngữ đến từ header middleware gắn. Danh mục nghề giữ 10 phút
 * trong data cache (occupationServer).
 */
export const dynamic = 'force-dynamic'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

export async function generateMetadata(): Promise<Metadata> {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.occupationPages.index.meta')
  const occupations = await fetchOccupations()
  const count = occupations?.length ?? 150
  return {
    title: t('title'),
    description: t('description', { count }),
    alternates: {
      canonical: localizedHref(locale, '/phong-van'),
      languages: hreflangAlternates('/phong-van'),
    },
    openGraph: {
      title: t('title'),
      description: t('description', { count }),
      locale: OG_LOCALE[locale],
      url: localizedHref(locale, '/phong-van'),
      siteName: 'myDeutschFlow',
      images: [DEFAULT_OG_IMAGE],
    },
    // Chưa tải được danh mục thì trang chỉ còn một câu báo lỗi — không cho lập chỉ mục bản đó.
    robots: occupations ? undefined : { index: false, follow: true },
  }
}

export default async function OccupationIndexPage() {
  const occupations = await fetchOccupations()
  return (
    <div className="ga-scope">
      <OccupationIndex occupations={occupations} />
    </div>
  )
}
