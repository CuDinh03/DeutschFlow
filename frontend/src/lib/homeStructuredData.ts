import { APP_STORE_URL, FACEBOOK_URL, SUPPORT_EMAIL } from '@/components/landing-v2/links'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'

const ORG_ID = `${SITE_URL}/#organization`
const APP_ID = `${SITE_URL}/#app`

const IN_LANGUAGE = { vi: 'vi-VN', en: 'en', de: 'de-DE' } as const

/**
 * Dữ liệu có cấu trúc của trang chủ (A1, kế hoạch cải thiện trang chủ 08/11/2026):
 * `Organization` (logo, email, `sameAs` App Store + Facebook) và `SoftwareApplication` (ứng dụng
 * học trên iOS + web, bắt đầu miễn phí). `FAQPage` vẫn nằm trong GaLanding cạnh khối FAQ.
 *
 * Không khai `aggregateRating`/`review`: chưa có đánh giá thật để dẫn (sổ lời hứa). Thiếu hai mục
 * đó Google không hiện thẻ sao cho ứng dụng, nhưng dữ liệu vẫn hợp lệ và nối được tổ chức với app.
 */
export function homeStructuredData(locale: keyof typeof IN_LANGUAGE, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'myDeutschFlow',
        url: absoluteUrl('/'),
        logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png'), width: 512, height: 512 },
        email: SUPPORT_EMAIL,
        sameAs: [APP_STORE_URL, FACEBOOK_URL],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: 'myDeutschFlow',
        url,
        description,
        inLanguage: IN_LANGUAGE[locale],
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'iOS, Web',
        downloadUrl: APP_STORE_URL,
        installUrl: APP_STORE_URL,
        image: absoluteUrl('/icon-512.png'),
        // Học thử không cần thanh toán trước: gói bắt đầu giá 0. Giá gói trả phí theo nước chưa chốt (bảng giá ẩn).
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'VND' },
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/**
 * `WebSite` cho layout gốc (SEO 3d, 13/11/2026): tên trang web Google hiện trên kết quả tìm kiếm,
 * nối về `Organization` của trang chủ qua `@id`. Không khai `SearchAction` — trang chưa có ô tìm kiếm.
 */
export function websiteStructuredData(locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: absoluteUrl('/'),
    name: 'myDeutschFlow',
    inLanguage: IN_LANGUAGE[locale as keyof typeof IN_LANGUAGE] ?? IN_LANGUAGE.vi,
    publisher: { '@id': ORG_ID },
  }
}

/** `BreadcrumbList` từ các mục [tên, đường dẫn] theo thứ tự từ gốc; URL tuyệt đối. */
export function breadcrumbStructuredData(items: readonly (readonly [name: string, path: string])[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absoluteUrl(path),
    })),
  }
}

/** Chuỗi JSON để nhét vào `<script type="application/ld+json">`; thoát "<" để không đóng nhầm thẻ. */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
