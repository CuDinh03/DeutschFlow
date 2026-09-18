/**
 * Kho cache phiên khách (localStorage) — tách riêng, KHÔNG phụ thuộc gì, để `authSession.logout()`
 * dọn được mà không kéo `features/onboarding/guestSession` (→ `lib/api` → `authSession`) thành vòng import.
 * Logic gọi server nằm ở `features/onboarding/guestSession.ts`.
 */

export const GUEST_SESSION_KEY = 'df_guest_session'

export interface GuestAnswers {
  motivation?: string
  goalType?: string
  currentLevel?: string | null
  targetLevel?: string
  industry?: string | null
  examType?: string | null
  dailyGoalMinutes?: number
  sessionsPerWeek?: number
  minutesPerSession?: number
  learningSpeed?: string
  pathChoice?: 'placement' | 'mock_exam' | 'skip' | null
}

export interface GuestSessionCache {
  sessionId: string
  /** ISO từ server (72 h). Hết hạn ⇒ cache coi như không có. */
  expiresAt: string
  currentStep: string
  answers: GuestAnswers
  savedAt: number
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readGuestSessionCache(now: number = Date.now()): GuestSessionCache | null {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(GUEST_SESSION_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<GuestSessionCache>
    if (!c || typeof c.sessionId !== 'string' || typeof c.expiresAt !== 'string') return null
    const exp = Date.parse(c.expiresAt)
    if (Number.isNaN(exp) || exp <= now) {
      clearGuestSessionCache()
      return null
    }
    return {
      sessionId: c.sessionId,
      expiresAt: c.expiresAt,
      currentStep: typeof c.currentStep === 'string' ? c.currentStep : 'INTRO',
      answers: c.answers && typeof c.answers === 'object' ? c.answers : {},
      savedAt: typeof c.savedAt === 'number' ? c.savedAt : now,
    }
  } catch {
    return null
  }
}

export function writeGuestSessionCache(cache: GuestSessionCache): void {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(cache))
  } catch {
    /* storage đầy / bị chặn — phiên vẫn sống trên server, chỉ mất con trỏ */
  }
}

export function clearGuestSessionCache(): void {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(GUEST_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
