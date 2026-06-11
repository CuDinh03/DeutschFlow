import type { MetadataRoute } from 'next'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { absoluteUrl } from '@/lib/siteUrl'

/**
 * Sitemap — chỉ liệt kê các trang công khai, có thể index (marketing/SEO).
 * Trang sau đăng nhập (admin/teacher/student/org) cố ý KHÔNG đưa vào.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/luyen-thi/'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/free-grade/'), changeFrequency: 'monthly', priority: 0.8 },
  ]

  const examPages: MetadataRoute.Sitemap = GERMAN_EXAMS.map((e) => ({
    url: absoluteUrl(`/luyen-thi/${e.slug}/`),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...staticPages, ...examPages]
}
