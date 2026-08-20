// Khoá quyết định điều hướng sau khi lưu hồ sơ onboarding.
//
// Test này tồn tại vì một lỗi thật (QA 2026-08-20, F-1): guard
// `postAction === 'EMAIL_CAPTURE_UPSELL' && !PRO_UNLOCKED_FREE` đảo nghĩa khi
// `IAP_ENABLED` bị lật sang true, khiến học viên A0 trên iOS bị đá sang màn
// upsell email và bỏ qua TOÀN BỘ onboarding v1 (wow first-sentence, spotlight
// tour, checklist tuần đầu, nhắc học 20:00). Lỗi sống hơn 6 tuần vì không có
// test nào chạm vào quyết định điều hướng.
//
// Bất biến: MỌI archetype đều đi qua màn wow trước khi vào app.

import { nextAfterProfile } from '../onboardingRouting'

describe('nextAfterProfile', () => {
  // Toàn bộ PostOnboardingAction của backend (user/onboarding/PostOnboardingAction.java)
  // + undefined (khi GET /onboarding/route lỗi mạng — best-effort).
  const ALL_POST_ACTIONS = [
    'ROADMAP_ALPHABET',
    'ROADMAP_NODE',
    'START_PRACTICE',
    'INTERVIEW_FIRST',
    'MOCK_HOOK_PAYWALL',
    'RADAR_CHECKOUT',
    'PRICING_CTA',
    'EMAIL_CAPTURE_UPSELL',
    undefined,
  ] as const

  test.each(ALL_POST_ACTIONS)('postAction=%s vẫn đi qua màn wow', (postAction) => {
    // Arrange + Act
    const target = nextAfterProfile(postAction)

    // Assert
    expect(target).toBe('/(auth)/first-sentence')
  })

  test('EMAIL_CAPTURE_UPSELL (A0 trên iOS) KHÔNG được rẽ sang Speaking — hồi quy F-1', () => {
    // Arrange
    const postAction = 'EMAIL_CAPTURE_UPSELL'

    // Act
    const target = nextAfterProfile(postAction)

    // Assert
    expect(target).not.toBe('/(student)/speaking')
    expect(target).toBe('/(auth)/first-sentence')
  })

  test('giá trị lạ từ backend mới cũng không thoát được màn wow', () => {
    expect(nextAfterProfile('SOME_FUTURE_ACTION')).toBe('/(auth)/first-sentence')
  })
})
