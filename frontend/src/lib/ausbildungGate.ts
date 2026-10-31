import type { PublicLocale } from '@/lib/publicLocale'

/**
 * Cổng hiển thị phần học nghề. Tách khỏi `@/lib/ausbildung` vì `LandingHeader` là component client có
 * mặt trên mọi trang công khai: import từ đây để dữ liệu 60 nghề và 28 doanh nghiệp không vào bundle.
 *
 * Nội dung là bản nháp AI soạn, nên theo luật nội dung của dự án phải có người duyệt trước khi mở. Chưa
 * duyệt thì `/hoc-nghe/` trả 404, không vào sitemap, không có mục trên menu, trang nghề không hiện khối
 * học nghề. Xem trước bằng `?ban-nhap=1`. Duyệt xong chỉ cần đổi AUSBILDUNG_CONTENT_REVIEWED thành true.
 * Bản nháp đọc để duyệt: plans/2026-10-31-hoc-nghe-nhap-de-duyet.md.
 */
export const AUSBILDUNG_CONTENT_REVIEWED = false

export const AUSBILDUNG_PAGE = '/hoc-nghe'
export const DRAFT_PREVIEW_PARAM = 'ban-nhap'

/** Trang chỉ có tiếng Việt và tiếng Anh: bản tiếng Đức chờ Impressum (việc riêng pháp lý). */
export type AusbildungLocale = Extract<PublicLocale, 'vi' | 'en'>

export function isAusbildungLocale(locale: string): locale is AusbildungLocale {
  return locale === 'vi' || locale === 'en'
}

export function ausbildungVisible(preview: string | string[] | undefined): boolean {
  if (AUSBILDUNG_CONTENT_REVIEWED) return true
  return (Array.isArray(preview) ? preview[0] : preview) === '1'
}

/** Giữ chế độ xem trước trên link nội bộ của phần học nghề; duyệt xong trả nguyên link. */
export function withDraftPreview(href: string): string {
  return AUSBILDUNG_CONTENT_REVIEWED ? href : `${href}?${DRAFT_PREVIEW_PARAM}=1`
}
