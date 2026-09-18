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
 *
 * Backend đã có từ #412 (`POST /api/onboarding/guest-session`, `PATCH …/{id}`, `POST /api/onboarding/claim`)
 * nhưng suốt từ đó web vẫn chỉ dùng draft localStorage 30 phút. Chuyển sang session server giải được
 * hai thứ draft không giải được:
 *  - I-7 (F-3): draft của khách A không bao giờ dính vào tài khoản B — `claim` khoá theo `sessionId`
 *    và server trả 400 khi phiên đã thuộc người khác; lúc đó client PHẢI vứt cả draft.
 *  - Quãng "đăng ký → (mã 6 số của Đợt B) → quay lại" dài hơn 30 phút cũng không mất câu trả lời
 *    (server giữ 72 h — Q-C).
 *
 * Draft localStorage GIỮ làm đường lùi: server hỏng / mất mạng lúc PATCH thì `claim` sẽ trả 'expired'
 * hoặc 'error' và trang rơi về replay draft như trước. Cache ở đây chỉ là con trỏ + bản chụp câu trả
 * lời (để biết trình độ khi gọi `/onboarding/route` sau claim), KHÔNG phải nguồn chân lý.
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

/**
 * Bảo đảm có một phiên khách còn hạn: dùng lại cache, không thì tạo mới. Trả `null` khi server
 * không tạo được (rate-limit, mất mạng) — phễu vẫn chạy bằng draft như trước, không chặn.
 */
export async function ensureGuestSession(locale: string): Promise<string | null> {
  const cached = readGuestSessionCache()
  if (cached) return cached.sessionId
  try {
    const { data } = await api.post<SessionResponse>('/onboarding/guest-session', {
      platform: 'WEB',
      locale: ['vi', 'en', 'de'].includes(locale) ? locale : 'vi',
    })
    writeGuestSessionCache({
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

/**
 * Ghi tiến độ khách lên server (best-effort, không chặn UI). Trường vắng mặt trong `answers` = không
 * đổi (hợp đồng PATCH). 404 (hết hạn / không tồn tại) hay 400 (đã claim) ⇒ vứt cache; mọi lỗi khác
 * giữ cache, lần sau thử lại.
 */
export async function syncGuestSession(
  currentStep: string,
  answers?: GuestAnswers,
  activityResult?: Record<string, unknown>,
): Promise<boolean> {
  const cached = readGuestSessionCache()
  if (!cached) return false
  const merged: GuestAnswers = { ...cached.answers, ...(answers ?? {}) }
  try {
    await api.patch(`/onboarding/guest-session/${cached.sessionId}`, {
      currentStep,
      ...(answers ? { answers: merged } : {}),
      ...(activityResult ? { activityResult } : {}),
    })
    writeGuestSessionCache({ ...cached, currentStep, answers: merged, savedAt: Date.now() })
    return true
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 400) clearGuestSessionCache()
    return false
  }
}

/**
 * Gắn phiên khách vào tài khoản vừa đăng nhập. Server phát lại hồ sơ (UPSERT) và ghi progress.
 *
 * - 'claimed'  → cache + draft đã được dọn (hồ sơ nằm trên server); `answers` là bản chụp cuối để
 *                caller biết trình độ mà hỏi `/onboarding/route`.
 * - 'foreign'  → 400: phiên thuộc người khác (I-7). Cache VÀ draft đều bị vứt — draft trên máy này
 *                là của người trước, replay nó là ghi đè hồ sơ tài khoản đang đăng nhập.
 * - 'expired'  → 404: hết hạn / không tồn tại. Cache vứt; caller được phép rơi về draft (cùng người).
 * - 'error'    → mạng / 5xx: giữ nguyên cache; caller rơi về draft, lần đăng nhập sau thử lại.
 * - 'none'     → không có cache.
 */
export async function claimGuestSession(): Promise<ClaimOutcome> {
  const cached = readGuestSessionCache()
  if (!cached) return { status: 'none' }
  try {
    const { data } = await api.post<{ claimed: boolean; alreadyClaimed: boolean; progress: ClaimProgress }>(
      '/onboarding/claim',
      { sessionId: cached.sessionId },
    )
    clearGuestSessionCache()
    clearOnboardingDraft()
    return { status: 'claimed', alreadyClaimed: data.alreadyClaimed, progress: data.progress, answers: cached.answers }
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 400) {
      clearGuestSessionCache()
      clearOnboardingDraft()
      return { status: 'foreign' }
    }
    if (status === 404) {
      clearGuestSessionCache()
      return { status: 'expired' }
    }
    return { status: 'error' }
  }
}
