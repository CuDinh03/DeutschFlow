/**
 * Định dạng ngày/giờ/số theo locale UI (F-I18N-04, audit UTF-8/i18n 06/09/2026).
 *
 * Trước đây 61 chỗ trong /v2 gọi thẳng `toLocaleString('vi-VN')` / `new Intl.NumberFormat('vi-VN')`
 * nên người dùng chọn EN/DE vẫn thấy ngày `06/09/2026 14:05` kiểu Việt và số `1.234,5`.
 * Mọi định dạng đi qua đây: locale UI (`vi` | `en` | `de`, cookie `locale` của next-intl) → BCP-47.
 *
 * - `en` → `en-GB` (ngày-trước-tháng như vi/de; tránh mơ hồ 06/09) — cùng lựa chọn với quotaReset.ts.
 * - Tiền VND giữ quy ước Việt (`1.234.567₫`) ở MỌI locale vì đơn vị tiền là VND: `formatVnd`.
 *
 * Hàm thuần (nhận `locale`) dùng cho module ngoài React; component dùng hook `useFmt()` (useFmt.ts).
 */

export type UiLocale = 'vi' | 'en' | 'de'

export const BCP47: Record<UiLocale, string> = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }

export function toUiLocale(locale: string | null | undefined): UiLocale {
  return locale === 'en' || locale === 'de' ? locale : 'vi'
}

export function toBcp47(locale: string | null | undefined): string {
  return BCP47[toUiLocale(locale)]
}

type DateInput = Date | string | number | null | undefined

function asDate(d: DateInput): Date | null {
  if (d === null || d === undefined || d === '') return null
  const dt = d instanceof Date ? d : new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

export const DATE_NUMERIC: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
export const TIME_SHORT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
export const DATE_TIME_SHORT: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }

/** Số nguyên/thập phân theo locale (`1.234` vi/de, `1,234` en). */
export function formatNumber(locale: string, n: number | null | undefined, opts?: Intl.NumberFormatOptions): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  return new Intl.NumberFormat(toBcp47(locale), opts).format(v)
}

/** Ngày dạng số `06/09/2026` (vi/en-GB) · `06.09.2026` (de). Chuỗi/ngày không hợp lệ → `—`. */
export function formatDate(locale: string, d: DateInput, opts: Intl.DateTimeFormatOptions = DATE_NUMERIC): string {
  const dt = asDate(d)
  return dt ? dt.toLocaleDateString(toBcp47(locale), opts) : '—'
}

/** Giờ:phút theo locale (`14:05`). */
export function formatTime(locale: string, d: DateInput, opts: Intl.DateTimeFormatOptions = TIME_SHORT): string {
  const dt = asDate(d)
  return dt ? dt.toLocaleTimeString(toBcp47(locale), opts) : '—'
}

/** Ngày + giờ ngắn theo locale (`06/09/2026 14:05`). */
export function formatDateTime(locale: string, d: DateInput, opts: Intl.DateTimeFormatOptions = DATE_TIME_SHORT): string {
  const dt = asDate(d)
  return dt ? dt.toLocaleString(toBcp47(locale), opts) : '—'
}

/** VND đầy đủ theo quy ước Việt ở mọi locale: `1.234.567₫`. */
export function formatVnd(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v).toLocaleString('vi-VN')}₫`
}

/**
 * VND rút gọn cho thẻ thống kê. vi giữ hậu tố quen thuộc `tỷ` / `tr` / `k`; en/de dùng
 * ký hiệu rút gọn của Intl (`1.2B₫` / `1,2 Mrd.₫`) thay vì chữ Việt.
 */
export function formatVndCompact(locale: string, n: number | null | undefined): string {
  const v = Number(n ?? 0)
  if (!Number.isFinite(v)) return '—'
  if (toUiLocale(locale) === 'vi') {
    if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}tỷ₫`
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}tr₫`
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k₫`
    return `${Math.round(v)}₫`
  }
  if (Math.abs(v) < 1_000) return `${Math.round(v)}₫`
  return `${new Intl.NumberFormat(toBcp47(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(v)}₫`
}
