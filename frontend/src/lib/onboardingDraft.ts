// Guest onboarding draft (value-first flow).
//
// A guest answers the onboarding funnel BEFORE creating an account. Their answers are held
// here (localStorage) and replayed to POST /onboarding/profile right after signup — so no
// account is required to experience the funnel + meet their mentor, and nothing is re-asked.
// No server "merge" endpoint is needed: the client simply defers the profile POST.

const KEY = 'df_onboarding_draft'

/**
 * Hạn dùng của draft. Draft KHÔNG gắn userId, mà effect resume ở màn onboarding
 * chạy cho bất kỳ tài khoản nào đã đăng nhập ghé qua đó. Không có hạn thì draft
 * mà khách A bỏ ngang sẽ nằm lại vô thời hạn và im lặng ghi đè hồ sơ của người
 * đăng ký kế tiếp trên cùng máy (QA 2026-08-20, F-3).
 *
 * 30 phút: dài hơn nhiều so với quãng "điền phễu → đăng ký → quay lại" thật sự
 * (trên web /v2/register chuyển thẳng về /v2/onboarding, tính bằng giây), nhưng
 * đủ ngắn để không sống qua một phiên dùng máy khác. Cùng giá trị với
 * mobile/lib/onboardingDraft.ts — sửa một bên thì sửa cả hai.
 */
export const DRAFT_TTL_MS = 30 * 60 * 1000

export interface OnboardingDraft {
  motivation: string
  goalType: string       // derived from motivation (EXAM → CERT, else WORK)
  currentLevel: string
  targetLevel: string
  industry: string | null
  examType: string | null
  /** Đợt 4 (18/09): phút/ngày như mobile — thay `weeklyTarget` của bản cũ. */
  dailyGoalMinutes: number
  /**
   * Đợt 4 PR-2 (19/09): lựa chọn đường của A1+ ở màn Chọn đường TRƯỚC tài khoản (I-9). Đường chính
   * là guest session (`answers.pathChoice`); draft giữ bản sao làm đường lùi. Vắng mặt = chưa chọn.
   */
  pathChoice?: 'placement' | 'mock_exam' | 'skip' | null
}

const PATH_CHOICES = ['placement', 'mock_exam', 'skip'] as const

/** Hình dạng thật sự nằm trên máy: draft + dấu thời gian để kiểm hạn. */
interface StoredDraft extends OnboardingDraft {
  savedAt: number
  /** Bản cũ (trước Đợt 4) — chỉ để đọc lại draft đang sống trên máy người dùng. */
  weeklyTarget?: number
}

/** 7 bài/tuần ~ 20′, 5 ~ 15′, 3 ~ 10′ — đúng bảng suy diễn của bản cũ. */
function dailyGoalFromLegacyWeekly(weekly: number): number {
  return weekly >= 7 ? 20 : weekly >= 5 ? 15 : 10
}

/** Persist the guest's funnel answers before bouncing to /register. No-op during SSR. */
export function saveOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return
  try {
    const stored: StoredDraft = { ...draft, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    /* storage full / disabled — the funnel just re-asks after signup */
  }
}

/**
 * Read the guest's funnel answers after signup. Returns null when absent,
 * malformed, or expired — and drops an expired draft so it can't resurface.
 */
export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<StoredDraft>
    // Minimal validation: targetLevel is the one required field of the profile.
    if (!d || typeof d.targetLevel !== 'string' || !d.targetLevel) return null
    // Thiếu savedAt = draft lưu trước bản vá TTL → coi như hết hạn. Thà bắt điền
    // lại bảng câu hỏi còn hơn ghi đè hồ sơ của nhầm người.
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > DRAFT_TTL_MS) {
      clearOnboardingDraft()
      return null
    }
    return {
      motivation: d.motivation ?? 'JOB',
      goalType: d.goalType ?? 'WORK',
      currentLevel: d.currentLevel ?? 'A0',
      targetLevel: d.targetLevel,
      industry: d.industry ?? null,
      examType: d.examType ?? null,
      dailyGoalMinutes: typeof d.dailyGoalMinutes === 'number'
        ? d.dailyGoalMinutes
        : typeof d.weeklyTarget === 'number' ? dailyGoalFromLegacyWeekly(d.weeklyTarget) : 15,
      // Chỉ thêm khi có giá trị hợp lệ — draft cũ/đường A0 giữ nguyên hình dạng (test logout/clearTokens so sánh sâu).
      ...((PATH_CHOICES as readonly string[]).includes(d.pathChoice as string)
        ? { pathChoice: d.pathChoice as OnboardingDraft['pathChoice'] }
        : {}),
    }
  } catch {
    return null
  }
}

/** Drop the draft once it has been replayed (or abandoned). */
export function clearOnboardingDraft(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
