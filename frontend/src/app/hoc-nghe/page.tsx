import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AusbildungPage } from '@/components/landing-v2/AusbildungPage'
import { AUSBILDUNG_COPY } from '@/content/ausbildung'
import {
  AUSBILDUNG_CONTENT_REVIEWED,
  AUSBILDUNG_PAGE,
  DRAFT_PREVIEW_PARAM,
  ausbildungVisible,
  isAusbildungLocale,
} from '@/lib/ausbildungGate'
import { fetchOccupations } from '@/lib/occupationServer'
import { DEFAULT_OG_IMAGE } from '@/lib/siteUrl'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, publicAlternates, publicHref } from '@/lib/publicLocale'

/**
 * Trang học nghề — `/hoc-nghe/` (vi) và `/en/vocational-training/` (en). Chưa có bản tiếng Đức (chờ
 * Impressum) nên hreflang chỉ gồm vi + en. `force-dynamic` như trang trung tâm: ngôn ngữ đến từ header
 * middleware gắn. Chưa duyệt nội dung thì 404, trừ khi xem trước bằng `?ban-nhap=1` (`@/lib/ausbildungGate`).
 */
export const dynamic = 'force-dynamic'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US' } as const

type Props = { searchParams?: Record<string, string | string[] | undefined> }

async function pageLocale() {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  return isAusbildungLocale(locale) ? locale : 'vi'
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (!ausbildungVisible(searchParams?.[DRAFT_PREVIEW_PARAM])) {
    return { robots: { index: false, follow: false } }
  }
  const locale = await pageLocale()
  const c = AUSBILDUNG_COPY[locale].meta
  const canonical = publicHref(locale, AUSBILDUNG_PAGE) ?? `${AUSBILDUNG_PAGE}/`
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical, languages: publicAlternates(AUSBILDUNG_PAGE) },
    openGraph: {
      title: c.title,
      description: c.description,
      locale: OG_LOCALE[locale],
      url: canonical,
      siteName: 'myDeutschFlow',
      images: [DEFAULT_OG_IMAGE],
    },
    robots: AUSBILDUNG_CONTENT_REVIEWED ? undefined : { index: false, follow: false },
  }
}

export default async function AusbildungRoute({ searchParams }: Props) {
  if (!ausbildungVisible(searchParams?.[DRAFT_PREVIEW_PARAM])) notFound()
  const [locale, occupations] = await Promise.all([pageLocale(), fetchOccupations()])
  return (
    <div className="ga-scope">
      <AusbildungPage locale={locale} occupations={occupations} />
    </div>
  )
}
