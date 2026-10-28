import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE } from '@/lib/siteUrl'
import { getLocale, getTranslations } from 'next-intl/server'
import { SchoolsPage } from '@/components/landing-v2/SchoolsPage'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, publicAlternates, publicHref } from '@/lib/publicLocale'

/**
 * Trang cho trung tâm và đơn vị đào tạo — `/trung-tam/` (vi) và `/en/schools/` (en), đợt 3a 24/10/2026.
 *
 * Mỗi ngôn ngữ một slug (PUBLIC_LOCALIZED_SLUGS): middleware rewrite `/en/schools/` về đây kèm header
 * ngôn ngữ. Chưa có bản tiếng Đức (chờ Impressum) nên hreflang chỉ gồm vi + en. `force-dynamic` như
 * trang chủ: ngôn ngữ đến từ header middleware gắn.
 */
export const dynamic = 'force-dynamic'

const PAGE = '/trung-tam'
const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

export async function generateMetadata(): Promise<Metadata> {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.schools.meta')
  const canonical = publicHref(locale, PAGE) ?? publicHref(DEFAULT_PUBLIC_LOCALE, PAGE) ?? `${PAGE}/`
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical,
      languages: publicAlternates(PAGE),
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: OG_LOCALE[locale],
      url: canonical,
      siteName: 'myDeutschFlow',
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

export default function SchoolsRoute() {
  return (
    <div className="ga-scope">
      <SchoolsPage />
    </div>
  )
}
