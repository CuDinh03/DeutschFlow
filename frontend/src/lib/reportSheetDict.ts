import reportDe from '../../messages/v2/report.de.json'
import reportEn from '../../messages/v2/report.en.json'
import reportVi from '../../messages/v2/report.vi.json'

/**
 * Từ điển của PHIẾU ĐÁNH GIÁ GỬI GIA ĐÌNH (R8, thiết kế 10/09/2026 §3.4).
 *
 * Vì sao không dùng `useTranslations`: trang công khai `/phieu/[token]` KHÔNG có phiên đăng nhập, nên
 * `request.ts` (đọc cookie `locale`) không nói lên ngôn ngữ người mở muốn — ngôn ngữ nằm ở `?lang` của
 * chính cái link mà trung tâm gửi đi. Còn ô XEM TRƯỚC của giáo viên phải hiện ĐÚNG ngôn ngữ sắp phát
 * hành, không phải ngôn ngữ giao diện giáo viên đang dùng. Cả hai chỗ vì thế chọn từ điển tường minh.
 *
 * Chuỗi vẫn nằm ở `messages/v2/report.{vi,en,de}.json` như mọi khu khác nên `check:i18n` vẫn gác được
 * tính đủ ba ngôn ngữ; chỉ có ĐƯỜNG ĐỌC là khác. Không đăng ký vào `V2_AREAS`: đăng ký sẽ nhét từ điển
 * phiếu vào payload của MỌI trang trong khi chỉ hai bề mặt cần nó.
 */
export type ReportLang = 'vi' | 'en' | 'de'

export const REPORT_LANGS: readonly ReportLang[] = ['vi', 'en', 'de'] as const

/** Khoá của từ điển phiếu — suy ra từ chính bản vi để thêm khoá mới là tự có kiểu. */
export type ReportSheetDict = typeof reportVi.report

const DICTS: Record<ReportLang, ReportSheetDict> = {
  vi: reportVi.report,
  en: reportEn.report,
  de: reportDe.report,
}

/** Ngôn ngữ hợp lệ, mọi giá trị lạ (hoặc thiếu) ⇒ `vi` (R8: mặc định tiếng Việt). */
export function resolveReportLang(raw: string | string[] | null | undefined): ReportLang {
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalized = (value ?? '').trim().toLowerCase()
  return (REPORT_LANGS as readonly string[]).includes(normalized) ? (normalized as ReportLang) : 'vi'
}

export function reportSheetDict(lang: ReportLang): ReportSheetDict {
  return DICTS[lang]
}

/** Thẻ `lang` của HTML cho trang công khai — tránh trình đọc màn hình đọc tiếng Đức bằng giọng Việt. */
export const HTML_LANG: Record<ReportLang, string> = { vi: 'vi', en: 'en', de: 'de' }

/** Locale BCP-47 để định dạng ngày/số theo đúng ngôn ngữ phiếu. */
export const BCP47: Record<ReportLang, string> = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }

/** Nội suy `{key}` — cùng cú pháp với next-intl để chuỗi dùng chung được giữa hai đường đọc. */
export function fillReport(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : whole,
  )
}
