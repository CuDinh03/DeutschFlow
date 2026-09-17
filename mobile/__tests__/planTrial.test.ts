// Khoá cách hiển thị trial (soát 02/09, F-20): backend trả isTrial/trialEndsAt
// từ /auth/me/plan — số ngày còn lại phải đếm đúng, không NaN, không âm.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import { isTrialActive, trialDaysLeft } from '@/stores/usePlanStore'

const NOW = new Date('2026-09-02T10:00:00.000Z')

// M-7 (Đợt 0 onboarding 17/09, Q1 28/08): trong thời gian dùng thử client KHÔNG chủ động mời
// nâng cấp. Selector này là cửa duy nhất — mọi bề mặt upsell chủ động đều hỏi nó.
describe('isTrialActive', () => {
  test.each<[string, Parameters<typeof isTrialActive>[0], boolean]>([
    ['plan null', null, false],
    ['plan undefined', undefined, false],
    ['isTrial=false dù còn mốc tương lai (đã trả tiền)', { isTrial: false, trialEndsAt: '2026-09-09T10:00:00.000Z' }, false],
    ['isTrial thiếu (backend cũ)', { trialEndsAt: '2026-09-09T10:00:00.000Z' }, false],
    ['trialEndsAt null → không có bằng chứng, hành xử như trước', { isTrial: true, trialEndsAt: null }, false],
    ['trialEndsAt thiếu', { isTrial: true }, false],
    ['trialEndsAt hỏng', { isTrial: true, trialEndsAt: 'not-a-date' }, false],
    ['trialEndsAt quá khứ → hết thử', { isTrial: true, trialEndsAt: '2026-09-01T10:00:00.000Z' }, false],
    ['trialEndsAt đúng bằng now → hết (mốc kết thúc là exclusive)', { isTrial: true, trialEndsAt: '2026-09-02T10:00:00.000Z' }, false],
    ['trialEndsAt tương lai → đang thử', { isTrial: true, trialEndsAt: '2026-09-09T10:00:00.000Z' }, true],
    ['còn 1 giây cũng là đang thử', { isTrial: true, trialEndsAt: '2026-09-02T10:00:01.000Z' }, true],
  ])('%s', (_label, plan, expected) => {
    expect(isTrialActive(plan, NOW)).toBe(expected)
  })

  test('mặc định lấy giờ hiện tại khi không truyền now', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(isTrialActive({ isTrial: true, trialEndsAt: future })).toBe(true)
    expect(isTrialActive({ isTrial: true, trialEndsAt: '2000-01-01T00:00:00.000Z' })).toBe(false)
  })
})

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
