// Khoá quyết định điều hướng sau khi hồ sơ onboarding đã nằm trên server.
//
// Test này tồn tại vì một lỗi thật (QA 2026-08-20, F-1): guard
// `postAction === 'EMAIL_CAPTURE_UPSELL' && !PRO_UNLOCKED_FREE` đảo nghĩa khi
// `IAP_ENABLED` bị lật sang true, khiến học viên A0 trên iOS bị đá sang màn
// upsell email và bỏ qua TOÀN BỘ onboarding v1. Lỗi sống hơn 6 tuần vì không
// có test nào chạm vào quyết định điều hướng.
//
// Đợt 3 PR-2 (19/09/2026): quyết định đi qua máy trạng thái chung. Bất biến giữ:
// A0 luôn qua Câu đầu tiên (I-1), học viên trung tâm không bao giờ bị hỏi đường
// (I-11), và không có tham số nào đến từ route API (`postAction` đã khai tử).

import { nextAfterProfile, routeNeedsLevel } from '../onboardingRouting'

describe('nextAfterProfile — A0 (I-1)', () => {
  test.each([null, undefined, '', 'A0', 'a0'])('trình độ %p → Câu đầu tiên, bất kể pathChoice', (level) => {
    expect(nextAfterProfile({ level, pathChoice: null })).toBe('/(auth)/first-sentence')
    expect(nextAfterProfile({ level, pathChoice: 'skip' })).toBe('/(auth)/first-sentence')
    expect(nextAfterProfile({ level, pathChoice: 'placement' })).toBe('/(auth)/first-sentence')
  })

  test('hồi quy F-1: A0 không bao giờ rơi thẳng vào app', () => {
    expect(nextAfterProfile({ level: 'A0' })).not.toBe('/(student)')
  })
})

describe('nextAfterProfile — học viên trung tâm (I-11)', () => {
  test.each(['ORG_ROSTER', 'ORG_INVITE'] as const)('%s A1+ → Câu đầu tiên, không hỏi đường', (accountSource) => {
    expect(nextAfterProfile({ level: 'B1', accountSource, pathChoice: null })).toBe('/(auth)/first-sentence')
    expect(nextAfterProfile({ level: 'B1', accountSource, pathChoice: 'placement' })).toBe('/(auth)/first-sentence')
    expect(nextAfterProfile({ level: 'B1', accountSource, pathChoice: 'skip' })).toBe('/(auth)/first-sentence')
  })
})

describe('nextAfterProfile — A1+ tự đăng ký', () => {
  test('chưa chọn đường (đăng ký thẳng, fixture R5) → màn Chọn đường', () => {
    expect(nextAfterProfile({ level: 'A2', pathChoice: null })).toBe('/(auth)/path-choice')
    expect(nextAfterProfile({ level: 'A2' })).toBe('/(auth)/path-choice')
  })

  test('đã chọn placement ở phễu khách (fixture C1 → claim) → Kiểm tra đầu vào', () => {
    expect(nextAfterProfile({ level: 'A1', pathChoice: 'placement' })).toBe('/(auth)/placement')
    expect(nextAfterProfile({ level: 'C1', accountSource: 'SELF', pathChoice: 'placement' })).toBe('/(auth)/placement')
  })

  test('bỏ qua (fixture C5) → Trang chủ tuần đầu, không qua Câu đầu tiên', () => {
    expect(nextAfterProfile({ level: 'B2', pathChoice: 'skip' })).toBe('/(student)')
  })

  test('mock_exam chỉ có trên web → mobile hỏi lại bằng màn Chọn đường', () => {
    expect(nextAfterProfile({ level: 'B1', pathChoice: 'mock_exam' })).toBe('/(auth)/path-choice')
  })

  test('accountSource thiếu (lỗi /context) = SELF: phễu thường', () => {
    expect(nextAfterProfile({ level: 'A1', accountSource: null, pathChoice: null })).toBe('/(auth)/path-choice')
  })
})

describe('routeNeedsLevel', () => {
  test('placement và path-choice cần trình độ qua param; hai màn kia không', () => {
    expect(routeNeedsLevel('/(auth)/placement')).toBe(true)
    expect(routeNeedsLevel('/(auth)/path-choice')).toBe(true)
    expect(routeNeedsLevel('/(auth)/first-sentence')).toBe(false)
    expect(routeNeedsLevel('/(student)')).toBe(false)
  })
})
