// Điểm quyết định DUY NHẤT cho "sau khi hồ sơ onboarding đã nằm trên server thì đi đâu".
//
// Onboarding v1 (plan 2026-07-17) từng định nghĩa: màn wow "câu tiếng Đức đầu tiên" là BẮT BUỘC
// với mọi archetype. Quyết định đó bị một cờ paywall gác rải rác trong JSX; khi `IAP_ENABLED`
// lật sang true (09/07) cờ đảo nghĩa và học viên A0 trên iOS lặng lẽ mất trọn onboarding v1
// suốt hơn 6 tuần (QA 2026-08-20, F-1). Bài học: quyết định điều hướng phải là hàm thuần có test.
//
// Onboarding v3.1 (kế hoạch 17/09/2026, Đợt 3 PR-2): A1+ có nhánh riêng — chọn đường
// (`PATH_CHOICE`) rồi kiểm tra đầu vào 10 câu (M8b) hoặc bỏ qua vào Trang chủ. Quyết định vẫn
// là hàm thuần, nhưng nay ĐI QUA máy trạng thái chung (`nextOnboardingState`, fixture
// `docs/onboarding-flow-spec.transitions.json`): đây chỉ là bảng ánh xạ trạng thái → màn, không
// có luật riêng. Bất biến giữ nguyên: A0/chưa chọn trình độ luôn qua Câu đầu tiên (I-1), học
// viên trung tâm không bao giờ bị hỏi đường (I-11), và KHÔNG tham số nào đến từ route API
// (`postAction` đã khai tử — Q-A 28/08, F-21).

import { isZeroLevel, nextOnboardingState, type AccountSource, type PathChoice } from '@/lib/onboardingMachine'

export type PostProfileRoute =
  | '/(auth)/first-sentence'
  | '/(auth)/placement'
  | '/(auth)/path-choice'
  | '/(student)'

export interface PostProfileContext {
  /** Trình độ tự khai; `null`/rỗng = A0. */
  level: string | null | undefined
  /** `SELF` khi không biết (lỗi /context, backend cũ) — phễu thường. */
  accountSource?: AccountSource | null
  /** Lựa chọn đường của A1+ (ghi ở phễu khách hoặc chưa có = `null`). */
  pathChoice?: PathChoice | null
}

/**
 * Màn tiếp theo sau `plan_ready` (hồ sơ đã lưu / claim xong).
 *
 * `mock_exam` (nói thử 3′) chỉ có trên web; mobile gặp giá trị này coi như CHƯA chọn để hỏi lại
 * bằng hai lựa chọn mobile có — không im lặng đẩy vào Câu đầu tiên của A0.
 */
export function nextAfterProfile(ctx: PostProfileContext): PostProfileRoute {
  const pathChoice = ctx.pathChoice === 'mock_exam' ? null : (ctx.pathChoice ?? null)
  const accountSource = ctx.accountSource ?? 'SELF'
  const level = ctx.level ?? null
  const state = nextOnboardingState('CREATING', 'plan_ready', {
    authed: true,
    hasPlan: false,
    accountSource,
    level,
    pathChoice,
  })
  // FIRST_LESSON có hai nghĩa: Câu đầu tiên (A0, học viên trung tâm) hoặc placement (A1+ tự đăng
  // ký đã chọn). Máy không phân biệt hai màn — bảng ánh xạ này phải giữ I-1 và I-11 tại đây.
  const isOrg = accountSource === 'ORG_ROSTER' || accountSource === 'ORG_INVITE'
  const wantsPlacement = pathChoice === 'placement' && !isZeroLevel(level) && !isOrg
  switch (state) {
    case 'HOME_WEEK1':
      return '/(student)'
    case 'PATH_CHOICE':
      return '/(auth)/path-choice'
    case 'FIRST_LESSON':
      return wantsPlacement ? '/(auth)/placement' : '/(auth)/first-sentence'
    default:
      // Máy không bao giờ trả trạng thái khác từ CREATING/plan_ready (I-13 giữ CREATING chỉ khi
      // sự kiện lạc chỗ). Đường lùi an toàn = Câu đầu tiên, không phải Trang chủ.
      return '/(auth)/first-sentence'
  }
}

/** Màn nào cần biết trình độ (đưa qua route param) — placement gọi API theo `claimedLevel`. */
export function routeNeedsLevel(route: PostProfileRoute): boolean {
  return route === '/(auth)/placement' || route === '/(auth)/path-choice'
}
