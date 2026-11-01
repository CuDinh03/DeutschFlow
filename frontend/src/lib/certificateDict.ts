import certificateDe from '../../messages/v2/certificate.de.json'
import certificateEn from '../../messages/v2/certificate.en.json'
import certificateVi from '../../messages/v2/certificate.vi.json'
import { REPORT_LANGS, resolveReportLang, type ReportLang } from '@/lib/reportSheetDict'

/**
 * Từ điển trang xác thực công khai `/certificate/[token]` (đợt 4A A+B+E).
 *
 * Cùng lý do với `reportSheetDict`: người mở link không có phiên đăng nhập, nên ngôn ngữ đọc từ
 * `?lang` chứ không từ cookie. Chuỗi nằm ở `messages/v2/certificate.{vi,en,de}.json` để `check:i18n`
 * vẫn gác đủ ba thứ tiếng; không đăng ký vào `V2_AREAS` vì chỉ một trang cần.
 *
 * Giấy là CHỨNG NHẬN HOÀN THÀNH KHOÁ HỌC, không phải chứng chỉ trình độ: không viết "đạt trình độ",
 * không nhắc Goethe hay telc (sổ lời hứa).
 */
export type CertificateLang = ReportLang
export const CERTIFICATE_LANGS: readonly CertificateLang[] = REPORT_LANGS
export const resolveCertificateLang = resolveReportLang

export type CertificateDict = typeof certificateVi.certificate

const DICTS: Record<CertificateLang, CertificateDict> = {
  vi: certificateVi.certificate,
  en: certificateEn.certificate,
  de: certificateDe.certificate,
}

export function certificateDict(lang: CertificateLang): CertificateDict {
  return DICTS[lang]
}

/** Thay `{tên}` trong chuỗi từ điển; trang này không có next-intl. */
export function fillCertificateText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}
