import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE } from '@/lib/siteUrl'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { OccupationDetailView } from '@/components/landing-v2/OccupationPages'
import { fetchOccupationDetail } from '@/lib/occupationServer'
import { occupationName } from '@/lib/occupationTypes'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'

/**
 * Phỏng vấn theo từng nghề — `/phong-van/[nghe]/` và bản `/en/`, `/de/` (đợt 2d A+B+E).
 *
 * Chỉ trang `reviewed` (bộ viết tay, hoặc lớp nghề có ≥3 câu đã duyệt) được lập chỉ mục; trang có
 * câu AI tạo chưa duyệt để `noindex, follow` cho tới khi duyệt — tránh bị coi là nội dung mỏng tự
 * sinh (phương án landing, mục trang công khai). Mã nghề lạ → 404; backend lỗi tạm (429/5xx) → 500,
 * không phải 404 (xem `occupationServer`).
 */
export const dynamic = 'force-dynamic'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

type Props = { params: { nghe: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await fetchOccupationDetail(params.nghe)
  if (!detail) return { robots: { index: false, follow: false } }
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.occupationPages.detail.meta')
  const o = detail.occupation
  const path = `/phong-van/${o.code}`
  const vars = { nameDe: o.nameDe, name: occupationName(o, locale) }
  return {
    title: t('title', vars),
    description: t('description', vars),
    alternates: { canonical: localizedHref(locale, path), languages: hreflangAlternates(path) },
    openGraph: {
      title: t('title', vars),
      description: t('description', vars),
      locale: OG_LOCALE[locale],
      url: localizedHref(locale, path),
      siteName: 'myDeutschFlow',
      images: [DEFAULT_OG_IMAGE],
    },
    robots: detail.reviewed ? undefined : { index: false, follow: true },
  }
}

export default async function OccupationPage({ params }: Props) {
  const detail = await fetchOccupationDetail(params.nghe)
  if (!detail) notFound()
  return (
    <div className="ga-scope">
      <OccupationDetailView detail={detail} />
    </div>
  )
}
