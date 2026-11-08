import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import { ogImage } from '@/lib/ogImage'
import { absoluteUrl } from '@/lib/siteUrl'
import { homeStructuredData, toJsonLd } from '@/lib/homeStructuredData'
import { IOS_APP_ID } from '@/components/landing-v2/links'
import HomeClient from './HomeClient'

/**
 * Homepage `/` — the Galerie marketing landing (shared GaLanding component).
 *
 * `force-dynamic`: like /login and the /v2 surface, the homepage must NOT be
 * statically prerendered and served with Next's default 1-year
 * `Cache-Control: s-maxage=31536000`. That long cache is what pinned a stale
 * shell on Amplify/CloudFront so the cutover never reached visitors. Dynamic
 * rendering keeps `/` fresh on every deploy.
 *
 * `.ga-scope` + galerie.css activate the UI 2.0 token layer for this route only;
 * the auth/native routing lives in the client child (HomeClient).
 */
export const dynamic = 'force-dynamic'

/**
 * Canonical + hreflang (đợt 1 A+B+E): `/` (vi), `/en/`, `/de/` là ba bản của cùng một trang.
 * Title/description lấy từ layout gốc (catalog `v2.landing.meta` theo locale của request).
 */
export async function generateMetadata(): Promise<Metadata> {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.meta')
  return {
    alternates: {
      canonical: localizedHref(locale, '/'),
      languages: hreflangAlternates('/'),
    },
    // `openGraph` của trang THAY HẲN bản của layout (Next không gộp sâu) — khai lại site_name/ảnh,
    // còn og:title/og:description Next tự lấy từ title/description của layout.
    openGraph: {
      locale: OG_LOCALE[locale],
      url: localizedHref(locale, '/'),
      siteName: 'myDeutschFlow',
      // A3 (08/11/2026): ảnh 1200×630 tiêu đề hero + thẻ báo cáo "Bạn đã nói / Nên nói".
      images: [ogImage('home', locale, t('title'))],
    },
    // Smart App Banner của Safari iOS: dải "Mở trong App Store" ở đầu trang, chỉ hiện trên iPhone/
    // iPad, người xem tắt được. Chỉ khai ở trang chủ — không chen vào trang làm bài trên web.
    itunes: { appId: IOS_APP_ID },
  }
}

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

export default async function HomePage() {
  const raw = await getLocale()
  const locale = isPublicLocale(raw) ? raw : DEFAULT_PUBLIC_LOCALE
  const t = await getTranslations('v2.landing.meta')
  // Organization + SoftwareApplication (A1, 08/11/2026). Render ở server để có ngay trong HTML đầu.
  const appLd = toJsonLd(homeStructuredData(locale, t('description'), absoluteUrl(localizedHref(locale, '/'))))
  return (
    <div className="ga-scope min-h-screen bg-ga-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: appLd }} />
      <HomeClient />
    </div>
  )
}
