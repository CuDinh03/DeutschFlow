import '@/styles/galerie.css'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { DEFAULT_PUBLIC_LOCALE, hreflangAlternates, isPublicLocale, localizedHref } from '@/lib/publicLocale'
import { DEFAULT_OG_IMAGE } from '@/lib/siteUrl'
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
      images: [DEFAULT_OG_IMAGE],
    },
    // Smart App Banner của Safari iOS: dải "Mở trong App Store" ở đầu trang, chỉ hiện trên iPhone/
    // iPad, người xem tắt được. Chỉ khai ở trang chủ — không chen vào trang làm bài trên web.
    itunes: { appId: IOS_APP_ID },
  }
}

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', de: 'de_DE' } as const

export default function HomePage() {
  return (
    <div className="ga-scope min-h-screen bg-ga-bg">
      <HomeClient />
    </div>
  )
}
