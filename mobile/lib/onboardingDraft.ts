import * as SecureStore from 'expo-secure-store'

// Guest onboarding draft (value-first flow) — the mobile twin of web's onboardingDraft.
//
// A guest answers the onboarding funnel BEFORE creating an account; their answers are stored
// here and replayed to POST /onboarding/profile right after signup. No account is required to
// run the funnel + meet a mentor, and nothing is re-asked. No server "merge" endpoint needed —
// the client just defers the profile POST.

const KEY = 'df_onboarding_draft'

export interface OnboardingDraft {
  motivation: string
  goalType: 'WORK' | 'CERT'   // derived from motivation (EXAM → CERT, else WORK)
  currentLevel: string | null
  targetLevel: string
  industry: string | null
  examType: string | null
  dailyGoal: string           // minutes/day as a string: '5' | '10' | '15' | '20'
}

/** Persist the guest's funnel answers before routing to /register. Best-effort. */
export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(draft))
  } catch {
    /* storage unavailable — the funnel just re-asks after signup */
  }
}

/** Read the guest's funnel answers after signup. Returns null when absent or malformed. */
export async function readOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<OnboardingDraft>
    // targetLevel is the one required field of the profile — treat its absence as no draft.
    if (!d || typeof d.targetLevel !== 'string' || !d.targetLevel) return null
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
