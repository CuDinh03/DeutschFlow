import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { occupationOgImage } from '@/lib/ogImage'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { OccupationDetailView } from '@/components/landing-v2/OccupationPages'
import { fetchIndexableOccupations, fetchOccupationDetail, fetchOccupations } from '@/lib/occupationServer'
import { occupationName, occupationTitleName } from '@/lib/occupationTypes'
import { breadcrumbStructuredData, toJsonLd } from '@/lib/homeStructuredData'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import { AUSBILDUNG_CONTENT_REVIEWED, DRAFT_PREVIEW_PARAM, ausbildungVisible } from '@/lib/ausbildungGate'

/**
 * Phỏng vấn theo từng nghề — `/phong-van/[nghe]/` và bản `/en/`, `/de/` (đợt 2d A+B+E).
 *
 * Chỉ trang `reviewed` (bộ viết tay, hoặc lớp nghề có ≥3 câu đã duyệt) được lập chỉ mục; trang có
 * câu AI tạo chưa duyệt để `noindex, follow` cho tới khi duyệt — tránh bị coi là nội dung mỏng tự
 * sinh (phương án landing, mục trang công khai). Mã nghề lạ → 404; backend lỗi tạm (429/5xx) → 500,
 * không phải 404 (xem `occupationServer`).
 */
export const dynamic = 'force-dynamic'

/** Google cắt tiêu đề quanh 60 ký tự. */
const MAX_TITLE = 60

/** Tên hai bậc đầu của BreadcrumbList (SEO 3d): trang chủ, trang tổng nghề. */
const CRUMBS = {
  vi: ['Trang chủ', 'Phỏng vấn theo nghề'],
  en: ['Home', 'Job interviews'],
  de: ['Startseite', 'Vorstellungsgespräche'],
} as const

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

type Props = { params: { nghe: string }; searchParams?: Record<string, string | string[] | undefined> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const detail = await fetchOccupationDetail(params.nghe)
  if (!detail) return { robots: { index: false, follow: false } }
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.occupationPages.detail.meta')
  const o = detail.occupation
  const path = `/phong-van/${o.code}`
  const vars = { nameDe: o.nameDe, name: occupationTitleName(o, locale) }
  // Quá 60 ký tự thì bỏ đuôi thương hiệu (SEO 3b); bản en/de có `titleShort` trùng `title` nên không đổi.
  const fullTitle = t('title', vars)
  const title = fullTitle.length > MAX_TITLE ? t('titleShort', vars) : fullTitle
  // Xem trước khối học nghề chưa duyệt: trang này không được vào chỉ mục dù nghề đã duyệt.
  const draftBlock = !AUSBILDUNG_CONTENT_REVIEWED && ausbildungVisible(searchParams?.[DRAFT_PREVIEW_PARAM])
  return {
    title,
    description: t('description', vars),
    alternates: { canonical: localizedHref(locale, path), languages: hreflangAlternates(path) },
    openGraph: {
      title,
      description: t('description', vars),
      locale: OG_LOCALE[locale],
      url: localizedHref(locale, path),
      siteName: 'myDeutschFlow',
      // A3: tên nghề + một câu hỏi đã duyệt (route `og/nghe/[file]`).
      images: [occupationOgImage(o.code, locale, title)],
    },
    robots: detail.reviewed && !draftBlock ? undefined : { index: false, follow: true },
  }
}

export default async function OccupationPage({ params, searchParams }: Props) {
  const detail = await fetchOccupationDetail(params.nghe)
  if (!detail) notFound()
  // Khối "Nghề liên quan" (cụm chủ đề): lỗi ở đây chỉ ẩn khối, không làm hỏng trang (cả hai trả `null`).
  const [catalog, indexable] = await Promise.all([fetchOccupations(), fetchIndexableOccupations()])
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const o = detail.occupation
  const crumbs = breadcrumbStructuredData([
    [CRUMBS[locale][0], localizedHref(locale, '/')],
    [CRUMBS[locale][1], localizedHref(locale, '/phong-van')],
    [occupationName(o, locale), localizedHref(locale, `/phong-van/${o.code}`)],
  ])
  return (
    <div className="ga-scope">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(crumbs) }} />
      <OccupationDetailView
        detail={detail}
        showTraining={ausbildungVisible(searchParams?.[DRAFT_PREVIEW_PARAM])}
        catalog={catalog}
        indexable={indexable}
      />
    </div>
  )
}
