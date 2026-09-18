import { isZeroLevel, nextOnboardingState, type AccountSource, type PathChoice } from './machine'

/**
 * Điểm quyết định DUY NHẤT cho "hồ sơ đã nằm trên server thì đi đâu" — bản web của
 * `mobile/lib/onboardingRouting.ts` (Đợt 4 PR-2, 19/09/2026; kế hoạch 17/09 §4.4 W5b/W7/W8).
 *
 * Trước đây trang tự rẽ theo ma trận `/onboarding/route` (`placementRequired/Optional`) — thứ owner
 * đã KHAI TỬ (§8.1) và từng ép A1+ vào placement khi mất mạng (W-1). Nay quyết định đi qua máy
 * trạng thái chung (`nextOnboardingState('CREATING','plan_ready')`, fixture
 * `docs/onboarding-flow-spec.transitions.json`); ma trận chỉ còn phục vụ analytics.
 *
 * `FIRST_LESSON` có nhiều nghĩa nên bảng ánh xạ này phải tự giữ I-1/I-11:
 * - A0 (kể cả học viên trung tâm A0) → **Ngày 1** `/v2/student/beginner` (W8a — thay vì roadmap).
 * - học viên trung tâm A1+ → lộ trình (Đợt 5 giữ nguyên; không hỏi đường — I-11).
 * - A1+ tự đăng ký: `placement` → bài 10 câu trong trang; `mock_exam` → nói thử 3′ (`/v2/onboarding/mock-exam`,
 *   W5b nối lại trang mồ côi); `skip` → HOME_WEEK1; chưa chọn → màn Chọn đường (fixture R5).
 *
 * HOME_WEEK1 tạm là lộ trình cho tới khi W10 (checklist tuần đầu trên dashboard) có mặt — đổi ở
 * MỘT chỗ này khi đó.
 */

export const BEGINNER_ROUTE = '/v2/student/beginner'
export const ROADMAP_ROUTE = '/v2/student/roadmap'
export const MOCK_EXAM_ROUTE = '/v2/onboarding/mock-exam'

export type PostProfileDestination =
  | { kind: 'beginner'; href: typeof BEGINNER_ROUTE }
  | { kind: 'roadmap'; href: typeof ROADMAP_ROUTE }
  | { kind: 'mock_exam'; href: typeof MOCK_EXAM_ROUTE }
  /** Ở lại trang: hiện bài kiểm tra đầu vào. */
  | { kind: 'placement' }
  /** Ở lại trang: hỏi Chọn đường. */
  | { kind: 'path_choice' }

export interface PostProfileContext {
  level: string | null | undefined
  accountSource?: AccountSource | null
  pathChoice?: PathChoice | null
}

export function nextAfterProfile(ctx: PostProfileContext): PostProfileDestination {
  const accountSource = ctx.accountSource ?? 'SELF'
  const level = ctx.level ?? null
  const pathChoice = ctx.pathChoice ?? null
  const state = nextOnboardingState('CREATING', 'plan_ready', {
    authed: true,
    hasPlan: false,
    accountSource,
    level,
    pathChoice,
  })
  const isOrg = accountSource === 'ORG_ROSTER' || accountSource === 'ORG_INVITE'
  switch (state) {
    case 'HOME_WEEK1':
      return { kind: 'roadmap', href: ROADMAP_ROUTE }
    case 'PATH_CHOICE':
      return { kind: 'path_choice' }
    case 'FIRST_LESSON':
      if (isZeroLevel(level)) return { kind: 'beginner', href: BEGINNER_ROUTE }
      if (isOrg) return { kind: 'roadmap', href: ROADMAP_ROUTE }
      if (pathChoice === 'mock_exam') return { kind: 'mock_exam', href: MOCK_EXAM_ROUTE }
      if (pathChoice === 'placement') return { kind: 'placement' }
      return { kind: 'roadmap', href: ROADMAP_ROUTE }
    default:
      // I-13 giữ CREATING chỉ khi sự kiện lạc chỗ — không xảy ra ở đây. Đường lùi = lộ trình (như trước).
      return { kind: 'roadmap', href: ROADMAP_ROUTE }
  }
}

/** Khách vừa qua quick win có phải chọn đường không (fixture T1–T4: A0 → cổng tài khoản, A1+ → Chọn đường). */
export function guestNeedsPathChoice(level: string | null | undefined): boolean {
  return (
    nextOnboardingState('TASTE', 'taste_done', {
      authed: false,
      hasPlan: false,
      accountSource: 'SELF',
      level: level ?? null,
      pathChoice: null,
    }) === 'PATH_CHOICE'
  )
}
