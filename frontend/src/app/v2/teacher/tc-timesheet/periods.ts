import type { TimesheetPeriod } from '@/lib/timesheetApi'

/**
 * Helper thuần cho bộ chọn kỳ công (A4/F03): trước đây màn hình khóa cứng tháng hiện tại nên
 * ngày 01/09 không có đường nào trên UI để nộp/sửa kỳ 08 còn mở — dù backend đã cho phép.
 */

export interface PeriodRange {
  fromDate: string
  toDate: string
}

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Trọn tháng cách tháng hiện tại `offset` tháng (0 = tháng này, -1 = tháng trước), theo lịch địa phương. */
export function monthRange(offset: number, now: Date = new Date()): PeriodRange {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { fromDate: iso(first), toDate: iso(last) }
}

/** Khóa định danh một kỳ trong bộ chọn — hai range trùng ngày là cùng một kỳ. */
export function rangeKey(r: PeriodRange): string {
  return `${r.fromDate}_${r.toDate}`
}

/**
 * Danh sách lựa chọn kỳ: tháng hiện tại luôn đứng đầu; các kỳ backend trả về xếp sau theo
 * periodStart giảm dần, kỳ trùng tháng hiện tại không lặp lại.
 */
export function periodOptions(
  periods: TimesheetPeriod[],
  now: Date = new Date(),
): { key: string; range: PeriodRange; period: TimesheetPeriod | null }[] {
  const current = monthRange(0, now)
  const currentKey = rangeKey(current)
  const currentPeriod = periods.find((p) => rangeKey({ fromDate: p.periodStart, toDate: p.periodEnd }) === currentKey) ?? null
  const rest = periods
    .filter((p) => rangeKey({ fromDate: p.periodStart, toDate: p.periodEnd }) !== currentKey)
    .slice()
    .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))
    .map((p) => ({
      key: rangeKey({ fromDate: p.periodStart, toDate: p.periodEnd }),
      range: { fromDate: p.periodStart, toDate: p.periodEnd },
      period: p,
    }))
  return [{ key: currentKey, range: current, period: currentPeriod }, ...rest]
}

/** Đã tồn tại kỳ nào phủ ngày đầu của tháng trước chưa — quyết định có hiện nút "Mở kỳ tháng trước". */
export function hasPreviousMonthPeriod(periods: TimesheetPeriod[], now: Date = new Date()): boolean {
  const prev = monthRange(-1, now)
  return periods.some((p) => p.periodStart <= prev.fromDate && p.periodEnd >= prev.fromDate)
}

/** Kỳ chỉ nộp được từ ngày cuối kỳ trở đi (guard thật nằm ở backend — đây là UX hint). */
export function submitAllowedFrom(periodEnd: string, now: Date = new Date()): boolean {
  return iso(now) >= periodEnd
}
