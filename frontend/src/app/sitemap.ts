import type { MetadataRoute } from 'next'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'
import { PUBLIC_LOCALES, PUBLIC_LOCALIZED_PATHS, hreflangAlternates, localizedHref } from '@/lib/publicLocale'
import { fetchOccupations } from '@/lib/occupationServer'

/** Một mục cho mỗi ngôn ngữ, mục nào cũng kèm đủ bảng hreflang (đợt 1 A+B+E, xem src/lib/publicLocale.ts). */
function localizedEntries(path: string, priority: number): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(hreflangAlternates(path)).map(([lang, href]) => [lang, absoluteUrl(href)]),
  )
  return PUBLIC_LOCALES.map((locale) => ({
    url: absoluteUrl(localizedHref(locale, path)),
    changeFrequency: 'weekly' as const,
    priority,
    alternates: { languages },
  }))
}

/**
 * Sitemap — chỉ liệt kê các trang công khai, có thể index (marketing/SEO).
 * Trang sau đăng nhập (admin/teacher/student/org) cố ý KHÔNG đưa vào.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const localizedPages: MetadataRoute.Sitemap = [
    ...Array.from(PUBLIC_LOCALIZED_PATHS).flatMap((path) => localizedEntries(path, path === '/' ? 1 : 0.8)),
    ...localizedEntries('/phong-van', 0.9),
  ]

  // Trang nghề (đợt 2d): chỉ nghề có bộ câu hỏi viết tay — chắc chắn "Đã duyệt" mà không cần gọi
  // chi tiết từng nghề. Nghề dùng bộ chung có ≥3 câu đã duyệt vẫn được lập chỉ mục (meta robots),
  // chỉ chưa nằm trong sitemap. Backend chưa có endpoint → bỏ qua phần này.
  const occupations = (await fetchOccupations()) ?? []
  const occupationPages = occupations
    .filter((o) => o.questionSet === 'CURATED')
    .flatMap((o) => localizedEntries(`/phong-van/${o.code}`, 0.7))

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

  return [...staticPages, ...examPages, ...occupationPages]
}
