import api from '@/lib/api'
import type { AccountSource } from '@/lib/onboardingMachine'

/**
 * `GET /onboarding/context` — Đợt 5 kế hoạch onboarding 17/09/2026 (§4.1 "Ba cửa vào").
 *
 * Một nguồn duy nhất để app rẽ lối: học viên trung tâm (`ORG_ROSTER` | `ORG_INVITE`) chưa có plan
 * đi bản rút gọn `PROFILE_LITE` (nhịp học + trình độ nếu thiếu), người tự đăng ký đi trọn phễu.
 * Client KHÔNG suy đoán từ `orgId`/gói ORG — chỉ tin `accountSource`.
 *
 * Bản web 1:1: `frontend/src/features/onboarding/context.ts`. Sửa một bên thì sửa bên kia.
 */

export interface OnboardingOrgInfo {
  orgId: number | null
  name: string | null
  classId: number | null
  className: string | null
}

export interface OnboardingContext {
  accountSource: AccountSource
  hasPlan: boolean
  org: OnboardingOrgInfo | null
  /** A0..C2 do hồ sơ/giáo trình đặt; `null` = bản rút gọn phải hỏi thêm một câu trình độ. */
  presetCurrentLevel: string | null
  trial: { isTrial: boolean; trialEndsAt: string | null } | null
}

/** Lỗi mạng / backend cũ (404) ⇒ `null`: caller coi như `SELF` và đi phễu thường — không chặn ai. */
export async function fetchOnboardingContext(): Promise<OnboardingContext | null> {
  try {
    const { data } = await api.get<OnboardingContext>('/onboarding/context')
    return data ?? null
  } catch {
    return null
  }
}

export function isOrgAccount(source: AccountSource | string | null | undefined): boolean {
  return source === 'ORG_ROSTER' || source === 'ORG_INVITE'
}

/** Học viên trung tâm chưa có lộ trình ⇒ `PROFILE_LITE` (fixture W4/W7). */
export function needsLiteProfile(ctx: OnboardingContext | null): ctx is OnboardingContext {
  return !!ctx && isOrgAccount(ctx.accountSource) && ctx.hasPlan === false
}

const CEFR_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

/** Server có thể trả chữ thường hoặc giá trị lạ (giáo trình nhập tay) — chỉ nhận đúng thang A0..C2. */
export function normalizePresetLevel(raw: string | null | undefined): CefrLevel | null {
  if (!raw) return null
  const up = raw.trim().toUpperCase()
  return (CEFR_LEVELS as readonly string[]).includes(up) ? (up as CefrLevel) : null
}

/**
 * Trung tâm không hỏi mục tiêu, nên `targetLevel` (trường bắt buộc của hồ sơ) lấy mặc định: B1 là
 * mốc phổ biến nhất của học viên đi Đức (Ausbildung/visa lao động); ai đã ở B1+ thì nhắm bậc kế
 * tiếp. Giáo viên/học viên sửa lại được ở Hồ sơ học tập.
 */
export function defaultTargetLevelFor(currentLevel: string | null | undefined): 'B1' | 'B2' | 'C1' | 'C2' {
  switch (normalizePresetLevel(currentLevel)) {
    case 'B1':
      return 'B2'
    case 'B2':
      return 'C1'
    case 'C1':
    case 'C2':
      return 'C2'
    default:
      return 'B1'
  }
}

export interface LiteProfileInput {
  currentLevel: string | null
  sessionsPerWeek: number
  dailyGoalMinutes: number
  minutesPerSession?: number
}

/**
 * Payload `POST /onboarding/profile` cho bản rút gọn. Cùng hợp đồng với wizard đầy đủ (server
 * UPSERT, đòi `goalType`, `targetLevel`, `sessionsPerWeek`, `minutesPerSession`); phần trung tâm quyết
 * (mục tiêu, lĩnh vực, kỳ thi) để trống cố ý — mentor mặc định theo WORK + không lĩnh vực.
 */
export function liteProfilePayload(input: LiteProfileInput) {
  const currentLevel = normalizePresetLevel(input.currentLevel) ?? 'A0'
  const sessionsPerWeek = input.sessionsPerWeek
  return {
    goalType: 'WORK' as const,
    targetLevel: defaultTargetLevelFor(currentLevel),
    currentLevel,
    motivation: null,
    ageRange: null,
    interests: [] as string[],
    industry: null,
    workUseCases: [] as string[],
    examType: null,
    sessionsPerWeek,
    minutesPerSession: input.minutesPerSession ?? 15,
    dailyGoalMinutes: input.dailyGoalMinutes,
    learningSpeed: sessionsPerWeek >= 7 ? 'FAST' : sessionsPerWeek >= 5 ? 'NORMAL' : 'SLOW',
  }
}

export type LiteProfilePayload = ReturnType<typeof liteProfilePayload>
