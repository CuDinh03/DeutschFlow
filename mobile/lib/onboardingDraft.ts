import * as SecureStore from 'expo-secure-store'

// Guest onboarding draft (value-first flow) — the mobile twin of web's onboardingDraft.
//
// A guest answers the onboarding funnel BEFORE creating an account; their answers are stored
// here and replayed to POST /onboarding/profile right after signup. No account is required to
// run the funnel + meet a mentor, and nothing is re-asked. No server "merge" endpoint needed —
// the client just defers the profile POST.

const KEY = 'df_onboarding_draft'

/**
 * Hạn dùng của draft. Draft KHÔNG gắn userId, mà effect resume ở màn onboarding
 * chạy cho bất kỳ tài khoản nào đã đăng nhập ghé qua đó. Không có hạn thì draft
 * mà khách A bỏ ngang sẽ nằm lại vô thời hạn và im lặng ghi đè hồ sơ của người
 * đăng ký kế tiếp trên cùng máy (QA 2026-08-20, F-3).
 *
 * 30 phút: dài hơn nhiều so với quãng "điền phễu → điền form đăng ký" thật sự,
 * nhưng đủ ngắn để không sống qua một phiên dùng máy khác.
 */
export const DRAFT_TTL_MS = 30 * 60 * 1000

export interface OnboardingDraft {
  motivation: string
  goalType: 'WORK' | 'CERT'   // derived from motivation (EXAM → CERT, else WORK)
  currentLevel: string | null
  targetLevel: string
  industry: string | null
  examType: string | null
  dailyGoal: string           // minutes/day as a string: '5' | '10' | '15' | '20'
}

/** Hình dạng thật sự nằm trên máy: draft + dấu thời gian để kiểm hạn. */
interface StoredDraft extends OnboardingDraft {
  savedAt: number
}

/** Persist the guest's funnel answers before routing to /register. Best-effort. */
export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  try {
    const stored: StoredDraft = { ...draft, savedAt: Date.now() }
    await SecureStore.setItemAsync(KEY, JSON.stringify(stored))
  } catch {
    /* storage unavailable — the funnel just re-asks after signup */
  }
}

/**
 * Read the guest's funnel answers after signup. Returns null when absent,
 * malformed, or expired — and drops an expired draft so it can't resurface.
 */
export async function readOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<StoredDraft>
    // targetLevel is the one required field of the profile — treat its absence as no draft.
    if (!d || typeof d.targetLevel !== 'string' || !d.targetLevel) return null
    // Thiếu savedAt = draft lưu trước bản vá TTL → coi như hết hạn. Thà bắt điền
    // lại bảng câu hỏi còn hơn ghi đè hồ sơ của nhầm người.
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DRAFT_TTL_MS) {
      await clearOnboardingDraft()
      return null
    }
    return {
      motivation: d.motivation ?? 'JOB',
      goalType: d.goalType === 'CERT' ? 'CERT' : 'WORK',
      currentLevel: typeof d.currentLevel === 'string' ? d.currentLevel : null,
      targetLevel: d.targetLevel,
      industry: typeof d.industry === 'string' ? d.industry : null,
      examType: typeof d.examType === 'string' ? d.examType : null,
      dailyGoal: typeof d.dailyGoal === 'string' ? d.dailyGoal : '15',
    }
  } catch {
    return null
  }
}

/** Drop the draft once it has been replayed (or abandoned). */
export async function clearOnboardingDraft(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    /* ignore */
  }
}
