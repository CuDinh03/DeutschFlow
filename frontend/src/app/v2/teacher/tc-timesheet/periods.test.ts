import { describe, expect, it } from 'vitest'
import { hasPreviousMonthPeriod, monthRange, periodOptions, rangeKey, submitAllowedFrom } from './periods'
import type { TimesheetPeriod } from '@/lib/timesheetApi'

const period = (start: string, end: string, status: TimesheetPeriod['status'] = 'OPEN'): TimesheetPeriod => ({
  id: 1,
  teacherId: 1,
  teacherName: null,
  periodStart: start,
  periodEnd: end,
  payUnit: 'SESSION',
  status,
  editable: status === 'OPEN' || status === 'REJECTED',
  totalSessions: 0,
  totalMinutes: 0,
  submittedAt: null,
  reviewedAt: null,
  rejectReason: null,
})

// Mốc cố định giữa tháng — tránh test phụ thuộc ngày chạy thật.
const NOW = new Date(2026, 8, 15) // 15/09/2026

describe('tc-timesheet periods (A4/F03)', () => {
  it('monthRange: 0 = trọn tháng này, -1 = trọn tháng trước (đúng ngày cuối tháng)', () => {
    expect(monthRange(0, NOW)).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30' })
    expect(monthRange(-1, NOW)).toEqual({ fromDate: '2026-08-01', toDate: '2026-08-31' })
    // Biên tháng 2 + qua năm: -2 từ 15/01 → tháng 11 năm trước.
    expect(monthRange(-2, new Date(2026, 0, 15))).toEqual({ fromDate: '2025-11-01', toDate: '2025-11-30' })
  })

  it('periodOptions: tháng hiện tại đứng đầu; kỳ trùng tháng không lặp; kỳ cũ xếp sau giảm dần', () => {
    const aug = period('2026-08-01', '2026-08-31', 'REJECTED')
    const sep = period('2026-09-01', '2026-09-30')
    const jul = period('2026-07-01', '2026-07-31', 'LOCKED')
    const opts = periodOptions([aug, sep, jul], NOW)

    expect(opts.map((o) => o.key)).toEqual([
      rangeKey({ fromDate: '2026-09-01', toDate: '2026-09-30' }),
      rangeKey({ fromDate: '2026-08-01', toDate: '2026-08-31' }),
      rangeKey({ fromDate: '2026-07-01', toDate: '2026-07-31' }),
    ])
    expect(opts[0].period).toBe(sep) // kỳ backend của tháng này được gắn vào option đầu
  })

  it('hasPreviousMonthPeriod: đúng khi có kỳ phủ ngày đầu tháng trước', () => {
    expect(hasPreviousMonthPeriod([period('2026-08-01', '2026-08-31')], NOW)).toBe(true)
    expect(hasPreviousMonthPeriod([period('2026-07-01', '2026-07-31')], NOW)).toBe(false)
    expect(hasPreviousMonthPeriod([], NOW)).toBe(false)
  })

  it('submitAllowedFrom: chỉ từ ngày cuối kỳ trở đi (ngày 01/09 nộp được kỳ hết 31/08)', () => {
    expect(submitAllowedFrom('2026-08-31', new Date(2026, 8, 1))).toBe(true)   // 01/09 ≥ 31/08
    expect(submitAllowedFrom('2026-09-30', NOW)).toBe(false)                    // 15/09 < 30/09
    expect(submitAllowedFrom('2026-09-15', NOW)).toBe(true)                     // đúng ngày cuối kỳ
  })
})
