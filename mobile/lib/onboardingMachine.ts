/**
 * Máy trạng thái onboarding v3.1 — bản thi công MOBILE (bản sao 1:1 của frontend/src/features/onboarding/machine.ts).
 *
 * NGUỒN CHÂN LÝ là fixture `docs/onboarding-flow-spec.transitions.json` (repo root): test
 * `onboardingMachine.test.ts` chạy `test.each` trên từng hàng của nó, và web (`frontend/src/features/onboarding/machine.ts`)
 * chạy cùng fixture. Đổi luồng = sửa fixture trước, hai bên đỏ, rồi mới sửa hai bản thi công.
 *
 * Vì sao là hàm thuần ngoài JSX: bài học F-1 (08/2026) — quyết định điều hướng nằm trong JSX thì
 * không test nào bắt được khi nó lặng lẽ đổi nghĩa (A0 iOS mất trọn onboarding hơn 6 tuần).
 *
 * Hai bản thi công phải GIỐNG NHAU về logic; khác nhau chỉ ở import. Sửa một bên thì sửa bên kia.
 */

export type OnbState =
  | 'WELCOME'
  | 'PROFILE'
  | 'PROFILE_LITE'
  | 'TASTE'
  | 'PATH_CHOICE'
  | 'AUTH_GATE'
  | 'CLAIMED'
  | 'CREATING'
  | 'FIRST_LESSON'
  | 'CELEBRATE'
  | 'HOME_WEEK1'
  | 'CORE_DONE'
  | 'HOME'

export type OnbEvent =
  | 'intro_done'
  | 'login_succeeded'
  | 'profile_submitted'
  | 'taste_done'
  | 'path_selected'
  | 'auth_succeeded'
  | 'claim_succeeded'
  | 'claim_failed'
  | 'plan_ready'
  | 'lesson_done'
  | 'lesson_skipped'
  | 'celebrate_done'
  | 'reminder_answered'

export type AccountSource = 'SELF' | 'ORG_ROSTER' | 'ORG_INVITE'
export type PathChoice = 'placement' | 'mock_exam' | 'skip'

export interface OnbContext {
  /** Có access token. */
  authed: boolean
  /** `GET /onboarding/status.hasPlan` (hoặc `/context` từ Đợt 5). */
  hasPlan: boolean
  accountSource: AccountSource
  /** Trình độ tự khai; `null` = chưa chọn = A0 theo ma trận (`LevelBand.of(null) = ZERO`). */
  level: string | null
  /** Lựa chọn đường của A1+; ghi trước tài khoản, thực thi sau claim (I-9). */
  pathChoice: PathChoice | null
}

export const ONBOARDING_FLOW_VERSION = 'onb_v3_1'

/** A0 hoặc chưa chọn — cùng nghĩa với băng ZERO của `OnboardingTypeResolver`. */
export function isZeroLevel(level: string | null | undefined): boolean {
  return level == null || level === '' || level.toUpperCase() === 'A0'
}

function isOrgAccount(ctx: OnbContext): boolean {
  return ctx.accountSource === 'ORG_ROSTER' || ctx.accountSource === 'ORG_INVITE'
}

/** Điểm hạ cánh của người ĐÃ có tài khoản khi vào phễu (intro hoặc đăng nhập). */
function landingForAccount(ctx: OnbContext): OnbState {
  if (ctx.hasPlan) return 'HOME'
  if (isOrgAccount(ctx)) return 'PROFILE_LITE'
  return 'PROFILE'
}

/** Sau khi có plan: đi đâu — I-1 (A0 luôn có bài đầu), học viên trung tâm không hỏi đường. */
function afterPlanReady(ctx: OnbContext): OnbState {
  if (isZeroLevel(ctx.level)) return 'FIRST_LESSON'
  if (isOrgAccount(ctx)) return 'FIRST_LESSON'
  if (ctx.pathChoice === 'skip') return 'HOME_WEEK1'
  if (ctx.pathChoice === 'placement' || ctx.pathChoice === 'mock_exam') return 'FIRST_LESSON'
  return 'PATH_CHOICE'
}

/**
 * Chuyển trạng thái thuần. Cặp (state, event) không có trong bảng ⇒ giữ nguyên state (I-13):
 * một sự kiện lạc chỗ (double-fire, race giữa hai instance màn) không được đẩy người dùng đi đâu.
 */
export function nextOnboardingState(state: OnbState, event: OnbEvent, ctx: OnbContext): OnbState {
  switch (state) {
    case 'WELCOME':
      if (event === 'intro_done') return ctx.authed ? landingForAccount(ctx) : 'PROFILE'
      if (event === 'login_succeeded') return landingForAccount(ctx)
      return state
    case 'PROFILE':
      if (event === 'profile_submitted') return ctx.authed ? 'CREATING' : 'TASTE'
      return state
    case 'PROFILE_LITE':
      if (event === 'profile_submitted') return 'CREATING'
      return state
    case 'TASTE':
      if (event === 'taste_done') return isZeroLevel(ctx.level) ? 'AUTH_GATE' : 'PATH_CHOICE'
      return state
    case 'PATH_CHOICE':
      if (event === 'path_selected') {
        if (!ctx.authed) return 'AUTH_GATE'
        return ctx.pathChoice === 'skip' ? 'HOME_WEEK1' : 'FIRST_LESSON'
      }
      return state
    case 'AUTH_GATE':
      if (event === 'auth_succeeded') return 'CLAIMED'
      return state
    case 'CLAIMED':
      if (event === 'claim_succeeded') return 'CREATING'
      if (event === 'claim_failed') return 'PROFILE'
      return state
    case 'CREATING':
      if (event === 'plan_ready') return afterPlanReady(ctx)
      return state
    case 'FIRST_LESSON':
      if (event === 'lesson_done') return 'CELEBRATE'
      if (event === 'lesson_skipped') return isZeroLevel(ctx.level) ? 'CELEBRATE' : 'HOME_WEEK1'
      return state
    case 'CELEBRATE':
      if (event === 'celebrate_done') return 'HOME_WEEK1'
      return state
    case 'HOME_WEEK1':
      if (event === 'reminder_answered') return 'CORE_DONE'
      return state
    case 'CORE_DONE':
    case 'HOME':
      return state
    default:
      return state
  }
}
