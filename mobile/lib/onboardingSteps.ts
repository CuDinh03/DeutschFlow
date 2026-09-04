// Mô hình bước cho wizard onboarding v2 (design 2026-09-02, docs/design/onboarding-mobile-v2).
//
// Tách thuần để khoá bằng test — bài học F-1 (2026-08-20): quyết định luồng nằm
// rải trong JSX thì không test nào bắt được khi nó lặng lẽ đổi nghĩa. Ở đây:
// thứ tự bước, điều kiện rời bước, và ước lượng hành trình.

export const ONBOARDING_STEP_IDS = ['motivation', 'levels', 'rhythm', 'focus'] as const
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number]

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEP_IDS.length

/**
 * Bước `levels` đòi trình độ mục tiêu (trường bắt buộc duy nhất của hồ sơ);
 * các bước khác luôn rời được vì đã có giá trị mặc định hoặc là tuỳ chọn.
 */
export function canLeaveStep(step: OnboardingStepId, state: { targetLevel: string | null }): boolean {
  if (step === 'levels') return !!state.targetLevel
  return true
}

export interface JourneyEstimate {
  nodes: number
  weeks: number
}

// Chỉ chứa cặp trình độ có số liệu THẬT (A0→B1 = 46 chặng/11 tuần, đo trên
// lộ trình prod sinh cho tài khoản mới 01/09). Cặp chưa đo trả null để UI
// hiện câu chung chung — không bịa số.
const JOURNEY_ESTIMATES: Record<string, JourneyEstimate> = {
  'A0→B1': { nodes: 46, weeks: 11 },
}

export function journeyEstimate(
  currentLevel: string | null,
  targetLevel: string | null,
): JourneyEstimate | null {
  if (!currentLevel || !targetLevel) return null
  return JOURNEY_ESTIMATES[`${currentLevel}→${targetLevel}`] ?? null
}
