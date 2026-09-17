import * as SecureStore from 'expo-secure-store'

/**
 * Kho cache phiên khách (SecureStore) — tách riêng, KHÔNG phụ thuộc `lib/api`, để
 * `deviceSessionState.clearDeviceSessionState()` (được `lib/api` require lúc 401) dọn được mà không
 * tạo vòng import `api → deviceSessionState → guestSession → api`. Logic gọi server ở `lib/guestSession.ts`.
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
  expiresAt: string
  currentStep: string
  answers: GuestAnswers
  savedAt: number
}

export async function readGuestSessionCache(now: number = Date.now()): Promise<GuestSessionCache | null> {
  try {
    const raw = await SecureStore.getItemAsync(GUEST_SESSION_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<GuestSessionCache>
    if (!c || typeof c.sessionId !== 'string' || typeof c.expiresAt !== 'string') return null
    const exp = Date.parse(c.expiresAt)
    if (Number.isNaN(exp) || exp <= now) {
      await clearGuestSessionCache()
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

export async function writeGuestSessionCache(cache: GuestSessionCache): Promise<void> {
  try {
    await SecureStore.setItemAsync(GUEST_SESSION_KEY, JSON.stringify(cache))
  } catch {
    /* kho hỏng — phiên vẫn sống trên server, chỉ mất con trỏ */
  }
}

export async function clearGuestSessionCache(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
