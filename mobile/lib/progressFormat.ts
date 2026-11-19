// Định dạng số liệu cho màn Tôi và tab Tiến bộ (giao diện v3.4, Đợt 6C, 19/11/2026).
// Hàm thuần, không import thành phần giao diện — test ở __tests__/progressFormat.test.ts.

/** Nhóm nghìn kiểu Việt: 1240 → "1.240". Không dựa vào Intl (Hermes trên bản OTA cũ thiếu dữ liệu vi). */
export function formatCountVi(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '0'
  const sign = n < 0 ? '-' : ''
  const digits = String(Math.trunc(Math.abs(n)))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Thời lượng đã nói: dưới một giờ ghi phút ("45 phút"), từ một giờ ghi giờ một chữ số thập phân
 * dấu phẩy ("3,2 giờ"; tròn giờ thì "3 giờ").
 */
export function formatSpokenTime(minutes: number | null | undefined): string {
  const m = minutes != null && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0
  if (m < 60) return `${m} phút`
  const hours = Math.round((m / 60) * 10) / 10
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',')
  return `${text} giờ`
}

export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

export interface WeekdayBar {
  label: (typeof WEEKDAY_LABELS)[number]
  minutes: number
  /** 0..1 so với ngày nhiều nhất tuần; tuần trống thì mọi cột 0. */
  ratio: number
  isToday: boolean
}

/**
 * Bảy cột Thứ Hai → Chủ nhật từ `weeklyProgress` của `/student/stats` (phút học mỗi ngày của tuần
 * hiện tại, Thứ Hai = phần tử 0). Thiếu phần tử thì coi là 0 phút; số âm/NaN cũng về 0.
 */
export function weekdayBars(minutes: readonly number[] | null | undefined, today: Date): WeekdayBar[] {
  const values = WEEKDAY_LABELS.map((_, i) => {
    const v = minutes?.[i]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
  })
  const max = Math.max(0, ...values)
  // getDay(): Chủ nhật = 0 ⇒ đổi về chỉ số Thứ Hai = 0.
  const todayIndex = (today.getDay() + 6) % 7
  return values.map((v, i) => ({
    label: WEEKDAY_LABELS[i],
    minutes: v,
    ratio: max > 0 ? v / max : 0,
    isToday: i === todayIndex,
  }))
}
