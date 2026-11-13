/**
 * Ngày nội dung đổi lần cuối của các trang tĩnh trong sitemap (`<lastmod>`).
 *
 * Google bỏ qua `lastmod` khi nó luôn là "hôm nay" — nên KHÔNG dùng `new Date()`. Sửa nội dung trang nào
 * (chữ, tiêu đề, khối mới — không tính đổi code không ảnh hưởng chữ) thì cập nhật ngày của trang đó.
 * Ngày gốc lấy từ lần commit cuối của trang (13/11/2026).
 */
export const PAGE_LASTMOD: Readonly<Record<string, string>> = {
  '/': '2026-11-14',
  '/about': '2026-11-08',
  '/phong-van': '2026-11-08',
  '/trung-tam': '2026-11-14',
  '/hoc-nghe': '2026-11-08',
  '/luyen-thi': '2026-11-08',
  '/free-grade': '2026-11-09',
  '/cam-nang': '2026-11-08',
  '/mydeutschflow-la-gi': '2026-11-14',
  '/chi-phi': '2026-11-14',
}

/** Trang nghề luyện thi `/luyen-thi/[slug]/` — nội dung ở `@/data/germanExams`. */
export const EXAM_PAGES_LASTMOD = '2026-11-09'

/**
 * Khuôn trang nghề `/phong-van/[nghe]/` (tiêu đề, H1, khối chung). Trang nghề lấy ngày mới hơn giữa
 * ngày này và ngày backend báo cho nội dung của nghề. 13/11/2026: tiêu đề/H1 tiếng Việt mới (SEO 3b).
 */
export const OCCUPATION_TEMPLATE_LASTMOD = '2026-11-14'

/** Ngày muộn hơn trong hai ngày ISO `yyyy-MM-dd` (so chuỗi là đủ). */
export function laterDate(a: string, b: string | null | undefined): string {
  return b && b > a ? b : a
}
