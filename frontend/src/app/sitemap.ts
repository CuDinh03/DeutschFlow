import type { MetadataRoute } from 'next'
import { GERMAN_EXAMS } from '@/data/germanExams'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'
import {
  PUBLIC_LOCALES,
  PUBLIC_LOCALIZED_PATHS,
  PUBLIC_LOCALIZED_SLUGS,
  hreflangAlternates,
  localizedHref,
  publicAlternates,
  publicHref,
} from '@/lib/publicLocale'
import { fetchIndexableOccupations, fetchOccupations } from '@/lib/occupationServer'
import { EXAM_PAGES_LASTMOD, OCCUPATION_TEMPLATE_LASTMOD, PAGE_LASTMOD, laterDate } from '@/lib/sitemapDates'
import { AUSBILDUNG_CONTENT_REVIEWED, AUSBILDUNG_PAGE } from '@/lib/ausbildungGate'

/** Một mục cho mỗi ngôn ngữ, mục nào cũng kèm đủ bảng hreflang (đợt 1 A+B+E, xem src/lib/publicLocale.ts). */
function localizedEntries(path: string, priority: number, lastModified: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(hreflangAlternates(path)).map(([lang, href]) => [lang, absoluteUrl(href)]),
  )
  return PUBLIC_LOCALES.map((locale) => ({
    url: absoluteUrl(localizedHref(locale, path)),
    lastModified,
    changeFrequency: 'weekly' as const,
    priority,
    alternates: { languages },
  }))
}

/** Trang mỗi ngôn ngữ một slug (đợt 3a): chỉ ngôn ngữ đã có bản, hreflang đúng các bản đó. */
function slugEntries(page: string, priority: number): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(publicAlternates(page)).map(([lang, href]) => [lang, absoluteUrl(href)]),
  )
  return PUBLIC_LOCALES.flatMap((locale) => {
    const href = publicHref(locale, page)
    return href ? [{ url: absoluteUrl(href), lastModified: PAGE_LASTMOD[page], changeFrequency: 'monthly' as const, priority, alternates: { languages } }] : []
  })
}

/**
 * Dựng lúc có request, không dựng lúc build (13/11/2026): bước build trên máy chủ không gọi được backend,
 * nên bản dựng sẵn chỉ có nghề bộ viết tay (168 thay vì 180 URL) và giữ nguyên tới lần làm mới 600 s
 * đầu tiên — mỗi lần deploy frontend có ~10 phút sitemap thiếu trang nghề. Crawler gọi sitemap ít, mỗi
 * lần chỉ thêm 1–2 request GET công khai tới backend.
 */
export const dynamic = 'force-dynamic'

/**
 * Sitemap — chỉ liệt kê các trang công khai, có thể index (marketing/SEO).
 * Trang sau đăng nhập (admin/teacher/student/org) cố ý KHÔNG đưa vào.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const localizedPages: MetadataRoute.Sitemap = [
    ...Array.from(PUBLIC_LOCALIZED_PATHS).flatMap((path) => localizedEntries(path, path === '/' ? 1 : 0.8, PAGE_LASTMOD[path])),
    ...localizedEntries('/phong-van', 0.9, PAGE_LASTMOD['/phong-van']),
    // Trang học nghề chỉ vào sitemap sau khi nội dung được duyệt (`@/lib/ausbildungGate`).
    ...Object.keys(PUBLIC_LOCALIZED_SLUGS)
      .filter((page) => page !== AUSBILDUNG_PAGE || AUSBILDUNG_CONTENT_REVIEWED)
      .flatMap((page) => slugEntries(page, 0.8)),
  ]

  // Trang nghề: CÙNG điều kiện meta robots của trang (`reviewed` — bộ viết tay, hoặc ≥3 câu lớp nghề
  // đã duyệt), backend tính sẵn ở `/indexable` kèm ngày sửa nội dung. Backend cũ chưa có endpoint → lùi
  // về bộ viết tay (chắc chắn reviewed); không gọi được backend → bỏ qua phần này.
  const indexable = (await fetchIndexableOccupations())
    ?? (await fetchOccupations())?.filter((o) => o.questionSet === 'CURATED').map((o) => ({ code: o.code, lastModified: null }))
    ?? []
  const occupationPages = indexable.flatMap((o) =>
    localizedEntries(`/phong-van/${o.code}`, 0.7, laterDate(OCCUPATION_TEMPLATE_LASTMOD, o.lastModified)))

  const staticPages: MetadataRoute.Sitemap = [
    ...localizedPages,
    { url: absoluteUrl('/luyen-thi/'), lastModified: PAGE_LASTMOD['/luyen-thi'], changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/free-grade/'), lastModified: PAGE_LASTMOD['/free-grade'], changeFrequency: 'monthly', priority: 0.8 },
    // Cẩm nang (đợt D, 08/11/2026) — chỉ tiếng Việt.
    { url: absoluteUrl('/cam-nang/'), lastModified: laterDate(PAGE_LASTMOD['/cam-nang'], GUIDE_ARTICLES.map((g) => g.published).sort().at(-1)), changeFrequency: 'weekly', priority: 0.7 },
    // Trang giới thiệu cho truy vấn thương hiệu (13/11/2026) — chỉ tiếng Việt.
    { url: absoluteUrl('/mydeutschflow-la-gi/'), lastModified: PAGE_LASTMOD['/mydeutschflow-la-gi'], changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/chi-phi/'), lastModified: PAGE_LASTMOD['/chi-phi'], changeFrequency: 'monthly', priority: 0.7 },
    ...GUIDE_ARTICLES.map((g) => ({ url: absoluteUrl(`/cam-nang/${g.slug}/`), lastModified: g.published, changeFrequency: 'monthly' as const, priority: 0.7 })),
    // `/giao-vien-mien-phi/` đã gộp vào trang trung tâm (đợt 3a, 301 trong next.config) — không liệt kê.
  ]

  const examPages: MetadataRoute.Sitemap = GERMAN_EXAMS.map((e) => ({
    url: absoluteUrl(`/luyen-thi/${e.slug}/`),
    lastModified: EXAM_PAGES_LASTMOD,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [...staticPages, ...examPages, ...occupationPages]
}
