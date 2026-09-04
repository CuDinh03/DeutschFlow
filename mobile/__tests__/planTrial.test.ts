// Khoá cách hiển thị trial (soát 02/09, F-20): backend trả isTrial/trialEndsAt
// từ /auth/me/plan — số ngày còn lại phải đếm đúng, không NaN, không âm.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import { trialDaysLeft } from '@/stores/usePlanStore'

const NOW = new Date('2026-09-02T10:00:00.000Z')

describe('trialDaysLeft', () => {
  test('thiếu mốc / mốc hỏng → null (không hiện dòng đếm ngược)', () => {
    expect(trialDaysLeft(null, NOW)).toBeNull()
    expect(trialDaysLeft(undefined, NOW)).toBeNull()
    expect(trialDaysLeft('not-a-date', NOW)).toBeNull()
  })

  test('làm tròn LÊN: còn 6 ngày rưỡi → "còn 7 ngày"', () => {
    expect(trialDaysLeft('2026-09-08T22:00:00.000Z', NOW)).toBe(7)
  })

  test('còn đúng ranh giới ngày', () => {
    expect(trialDaysLeft('2026-09-03T10:00:00.000Z', NOW)).toBe(1)
  })

  test('đã quá hạn → 0, không âm', () => {
    expect(trialDaysLeft('2026-09-01T10:00:00.000Z', NOW)).toBe(0)
  })
})
