import type { MetadataRoute } from 'next'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { PUBLIC_LOCALES, PUBLIC_LOCALIZED_PATHS, hreflangAlternates, localizedHref } from '@/lib/publicLocale'

/**
 * Sitemap — chỉ liệt kê các trang công khai, có thể index (marketing/SEO).
 * Trang sau đăng nhập (admin/teacher/student/org) cố ý KHÔNG đưa vào.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Trang công khai đã dịch: một mục cho mỗi ngôn ngữ, mục nào cũng kèm đủ bảng hreflang
  // (đợt 1 A+B+E, xem src/lib/publicLocale.ts).
  const localizedPages: MetadataRoute.Sitemap = Array.from(PUBLIC_LOCALIZED_PATHS).flatMap((path) => {
    const languages = Object.fromEntries(
      Object.entries(hreflangAlternates(path)).map(([lang, href]) => [lang, absoluteUrl(href)]),
    )
    return PUBLIC_LOCALES.map((locale) => ({
      url: absoluteUrl(localizedHref(locale, path)),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.8,
      alternates: { languages },
    }))
  })

  const staticPages: MetadataRoute.Sitemap = [
    ...localizedPages,
    { url: absoluteUrl('/luyen-thi/'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/free-grade/'), changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/giao-vien-mien-phi/'), changeFrequency: 'monthly', priority: 0.8 },
  ]

  const examPages: MetadataRoute.Sitemap = GERMAN_EXAMS.map((e) => ({
    url: absoluteUrl(`/luyen-thi/${e.slug}/`),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...staticPages, ...examPages]
}
