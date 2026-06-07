// Guest onboarding draft (value-first flow).
//
// A guest answers the onboarding funnel BEFORE creating an account. Their answers are held
// here (localStorage) and replayed to POST /onboarding/profile right after signup — so no
// account is required to experience the funnel + meet their mentor, and nothing is re-asked.
// No server "merge" endpoint is needed: the client simply defers the profile POST.

const KEY = 'df_onboarding_draft'

export interface OnboardingDraft {
  motivation: string
  goalType: string       // derived from motivation (EXAM → CERT, else WORK)
  currentLevel: string
  targetLevel: string
  industry: string
  examType: string
  weeklyTarget: number
}

/** Persist the guest's funnel answers before bouncing to /register. No-op during SSR. */
export function saveOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* storage full / disabled — the funnel just re-asks after signup */
  }
}

/** Read the guest's funnel answers after signup. Returns null when absent or malformed. */
export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<OnboardingDraft>
    // Minimal validation: targetLevel is the one required field of the profile.
    if (!d || typeof d.targetLevel !== 'string' || !d.targetLevel) return null
    return {
      motivation: d.motivation ?? 'JOB',
      goalType: d.goalType ?? 'WORK',
      currentLevel: d.currentLevel ?? 'A0',
      targetLevel: d.targetLevel,
      industry: d.industry ?? 'IT',
      examType: d.examType ?? 'GOETHE',
      weeklyTarget: typeof d.weeklyTarget === 'number' ? d.weeklyTarget : 5,
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
