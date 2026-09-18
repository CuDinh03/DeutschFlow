import { Platform } from 'react-native'
import api from '@/lib/api'
import { clearOnboardingDraft } from '@/lib/onboardingDraft'
import {
  clearGuestSessionCache,
  readGuestSessionCache,
  writeGuestSessionCache,
  type GuestAnswers,
} from '@/lib/guestSessionStore'

/**
 * Guest session — phiên onboarding của KHÁCH sống trên server (spec §4.3, Đợt 2 kế hoạch 17/09).
 * Bản mobile của `frontend/src/features/onboarding/guestSession.ts`; cùng hợp đồng, cùng bốn kết cục
 * claim. Khác nhau chỉ ở kho lưu (SecureStore) và platform (IOS|ANDROID).
 *
 * Draft SecureStore 30 phút GIỮ làm đường lùi. Cache ở đây là con trỏ + bản chụp câu trả lời, không
 * phải nguồn chân lý. I-7: claim 400 = phiên của người khác ⇒ vứt CẢ draft trên máy này.
 */

export {
  GUEST_SESSION_KEY,
  clearGuestSessionCache,
  readGuestSessionCache,
  type GuestAnswers,
  type GuestSessionCache,
} from '@/lib/guestSessionStore'

interface SessionResponse {
  sessionId: string
  currentStep: string
  flowVersion: string
  expiresAt: string
}

export interface ClaimProgress {
  flowVersion: string
  lastStep: string
  completedActivities: string[]
  activatedAt: string | null
  coreCompletedAt: string | null
}

export type ClaimOutcome =
  | { status: 'claimed'; alreadyClaimed: boolean; progress: ClaimProgress; answers: GuestAnswers }
  | { status: 'none' }
  | { status: 'expired' }
  | { status: 'foreign' }
  | { status: 'error' }

export function guestPlatform(): 'IOS' | 'ANDROID' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID'
}

/** Dùng lại phiên còn hạn hoặc tạo mới; `null` khi server không tạo được — phễu vẫn chạy bằng draft. */
export async function ensureGuestSession(locale: 'vi' | 'en' | 'de' = 'vi'): Promise<string | null> {
  const cached = await readGuestSessionCache()
  if (cached) return cached.sessionId
  try {
    const { data } = await api.post<SessionResponse>('/onboarding/guest-session', {
      platform: guestPlatform(),
      locale,
    })
    await writeGuestSessionCache({
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      currentStep: data.currentStep,
      answers: {},
      savedAt: Date.now(),
    })
    return data.sessionId
  } catch {
    return null
  }
}

/** PATCH best-effort. 404/400 ⇒ vứt cache; lỗi khác giữ để thử lại. */
export async function syncGuestSession(
  currentStep: string,
  answers?: GuestAnswers,
  activityResult?: Record<string, unknown>,
): Promise<boolean> {
  const cached = await readGuestSessionCache()
  if (!cached) return false
  const merged: GuestAnswers = { ...cached.answers, ...(answers ?? {}) }
  try {
    await api.patch(`/onboarding/guest-session/${cached.sessionId}`, {
      currentStep,
      ...(answers ? { answers: merged } : {}),
      ...(activityResult ? { activityResult } : {}),
    })
    await writeGuestSessionCache({ ...cached, currentStep, answers: merged, savedAt: Date.now() })
    return true
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 400) await clearGuestSessionCache()
    return false
  }
}

/** Xem chú thích cùng tên ở bản web: claimed | foreign (400, vứt cả draft) | expired (404) | error | none. */
export async function claimGuestSession(): Promise<ClaimOutcome> {
  const cached = await readGuestSessionCache()
  if (!cached) return { status: 'none' }
  try {
    const { data } = await api.post<{ claimed: boolean; alreadyClaimed: boolean; progress: ClaimProgress }>(
      '/onboarding/claim',
      { sessionId: cached.sessionId },
    )
    await clearGuestSessionCache()
    await clearOnboardingDraft()
    return { status: 'claimed', alreadyClaimed: data.alreadyClaimed, progress: data.progress, answers: cached.answers }
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 400) {
      await clearGuestSessionCache()
      await clearOnboardingDraft()
      return { status: 'foreign' }
    }
    if (status === 404) {
      await clearGuestSessionCache()
      return { status: 'expired' }
    }
    return { status: 'error' }
  }
}
