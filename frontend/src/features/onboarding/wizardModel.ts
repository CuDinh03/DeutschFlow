import type { GuestAnswers } from '@/lib/guestSessionStore'

/**
 * Mô hình bước của wizard onboarding web — Đợt 4 (kế hoạch 17/09/2026 §4.4 W1–W4, gap W-18).
 *
 * Thứ tự và trường KHỚP mobile (`mobile/lib/onboardingSteps.ts`, UI v2 #463): mục tiêu → trình độ
 * (A0 chọn sẵn + thẻ hành trình) → nhịp (`dailyGoalMinutes` 5/10/15/20) → lĩnh vực/kỳ thi + mentor.
 * `weeklyTarget` của bản cũ bỏ hẳn: `sessionsPerWeek`/`minutesPerSession` là hằng 5×15 như mobile,
 * `learningSpeed` NORMAL — hai client gửi cùng một hợp đồng (spec §5.1 `OnboardingAnswers`).
 *
 * Tách thuần để khoá bằng test (bài học F-1): thứ tự bước, điều kiện rời bước, ước lượng hành
 * trình và hình dạng payload không nằm trong JSX.
 */

export const WIZARD_STEP_IDS = ['motivation', 'level', 'rhythm', 'focus'] as const
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number]
export const WIZARD_STEP_COUNT = WIZARD_STEP_IDS.length

export const DEFAULT_SESSIONS_PER_WEEK = 5
export const DEFAULT_MINUTES_PER_SESSION = 15
export const DEFAULT_DAILY_GOAL_MINUTES = 15

export const DAILY_GOAL_OPTIONS = [5, 10, 15, 20] as const
export const CURRENT_LEVEL_OPTIONS = ['A0', 'A1', 'A2', 'B1', 'B2'] as const
export const TARGET_LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export type GoalType = 'WORK' | 'CERT'

/** "Vì sao bạn học?" → goalType thô mà plan còn dùng (EXAM → CERT, còn lại WORK). */
export const MOTIVATIONS: { value: string; goal: GoalType; icon: string }[] = [
  { value: 'JOB', goal: 'WORK', icon: 'work' },
  { value: 'AUSBILDUNG', goal: 'WORK', icon: 'build' },
  { value: 'STUDY', goal: 'WORK', icon: 'school' },
  { value: 'IMMIGRATION', goal: 'WORK', icon: 'home' },
  { value: 'EXAM', goal: 'CERT', icon: 'workspace_premium' },
  { value: 'HOBBY', goal: 'WORK', icon: 'auto_awesome' },
]

export function goalTypeFor(motivation: string): GoalType {
  return MOTIVATIONS.find((m) => m.value === motivation)?.goal ?? 'WORK'
}

/** Cùng danh sách với mobile (`INDUSTRIES` trong onboarding.tsx) — nhãn ở catalog `focus.industry.<mã>`. */
export const INDUSTRIES = ['IT', 'Pflege', 'Gastronomie', 'Verkauf', 'Tourismus', 'Technik'] as const
export const EXAMS = ['GOETHE', 'TELC', 'TESTDAF'] as const

export interface WizardAnswers {
  motivation: string
  currentLevel: string
  targetLevel: string
  dailyGoalMinutes: number
  /** Không bắt buộc (như mobile): null = chưa chọn/bỏ qua. */
  industry: string | null
  examType: string | null
}

export const DEFAULT_ANSWERS: WizardAnswers = {
  motivation: 'JOB',
  currentLevel: 'A0',
  targetLevel: 'B1',
  dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
  industry: null,
  examType: null,
}

/**
 * Bước `level` đòi trình độ mục tiêu (trường bắt buộc duy nhất của hồ sơ); các bước khác luôn
 * rời được vì đã có mặc định hoặc là tuỳ chọn.
 */
export function canLeaveStep(step: WizardStepId, answers: Pick<WizardAnswers, 'targetLevel'>): boolean {
  if (step === 'level') return !!answers.targetLevel
  return true
}

export interface JourneyEstimate {
  nodes: number
  weeks: number
}

// Chỉ chứa cặp trình độ có số liệu THẬT (A0→B1 = 46 chặng/11 tuần, đo trên lộ trình prod sinh cho
// tài khoản mới 01/09). Cặp chưa đo trả null để UI hiện câu chung — không bịa số. Cùng bảng với mobile.
const JOURNEY_ESTIMATES: Record<string, JourneyEstimate> = {
  'A0→B1': { nodes: 46, weeks: 11 },
}

export function journeyEstimate(currentLevel: string | null, targetLevel: string | null): JourneyEstimate | null {
  if (!currentLevel || !targetLevel) return null
  return JOURNEY_ESTIMATES[`${currentLevel}→${targetLevel}`] ?? null
}

/** Payload `POST /onboarding/profile` — cùng hợp đồng với mobile (`handleSubmit` trong onboarding.tsx). */
export function profilePayloadFrom(a: WizardAnswers) {
  const goalType = goalTypeFor(a.motivation)
  return {
    goalType,
    targetLevel: a.targetLevel,
    currentLevel: a.currentLevel,
    motivation: a.motivation,
    industry: goalType === 'WORK' ? a.industry : null,
    examType: goalType === 'CERT' ? a.examType : null,
    sessionsPerWeek: DEFAULT_SESSIONS_PER_WEEK,
    minutesPerSession: DEFAULT_MINUTES_PER_SESSION,
    dailyGoalMinutes: a.dailyGoalMinutes,
    learningSpeed: 'NORMAL' as const,
  }
}

/** Bản chụp gửi lên phiên khách (spec §5.1) — cùng trường với payload, thêm goalType tường minh (+ pathChoice khi A1+ đã chọn). */
export function guestAnswersFrom(a: WizardAnswers, pathChoice: GuestAnswers['pathChoice'] = null): GuestAnswers {
  const p = profilePayloadFrom(a)
  return {
    ...(pathChoice ? { pathChoice } : {}),
    motivation: p.motivation,
    goalType: p.goalType,
    currentLevel: p.currentLevel,
    targetLevel: p.targetLevel,
    industry: p.industry,
    examType: p.examType,
    dailyGoalMinutes: p.dailyGoalMinutes,
    sessionsPerWeek: p.sessionsPerWeek,
    minutesPerSession: p.minutesPerSession,
    learningSpeed: p.learningSpeed,
  }
}

/**
 * Số bước hiện trên progressbar theo nhánh (W-13): khách có thêm quick win + cổng tài khoản, và
 * (Đợt 4 PR-2) thêm Chọn đường khi tự khai A1+ — đúng máy trạng thái TASTE → PATH_CHOICE → AUTH_GATE.
 */
export function totalStepsFor(isGuest: boolean, currentLevel: string | null = null): number {
  if (!isGuest) return WIZARD_STEP_COUNT
  const zero = !currentLevel || currentLevel.toUpperCase() === 'A0'
  return WIZARD_STEP_COUNT + (zero ? 2 : 3)
}
