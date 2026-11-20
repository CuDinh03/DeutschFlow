/**
 * Logic thuần của luồng mã PIN đăng ký (thiết kế 05/11 §7.2) — tách khỏi màn
 * `app/(auth)/verify-email.tsx` để jest (ts-jest, không render) kiểm được.
 *
 * Hợp đồng backend:
 *   POST /auth/register/start  → 202 { email, expiresInSeconds, resendAfterSeconds, codeLength } · 501 công tắc tắt
 *   POST /auth/register/verify → 201 AuthResponse · 400 extensions.reason INVALID_CODE (+remainingAttempts) | LOCKED | EXPIRED
 *                                · 409 email vừa có tài khoản · 429
 *   POST /auth/register/resend → 204 luôn luôn · 429
 * Giao diện KHÔNG hiện mã máy (`reason`) — chỉ dùng để chọn câu.
 */

export const PIN_LENGTH = 6

type ErrLike = {
  response?: {
    status?: number
    data?: { extensions?: { reason?: unknown; remainingAttempts?: unknown } }
  }
}

/** Gõ hoặc dán ("12 34 56", "Mã: 123456") ⇒ chỉ giữ chữ số, cắt đúng 6. */
export function sanitizePin(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

/** Còn bao nhiêu giây mới được bấm "Gửi lại" (làm tròn lên, không âm). */
export function resendSecondsLeft(sentAtMs: number, resendAfterSeconds: number, nowMs: number): number {
  return Math.max(0, Math.ceil((sentAtMs + resendAfterSeconds * 1000 - nowMs) / 1000))
}

/** Đồng hồ đếm ngược "Gửi lại sau 0:42" (mẫu v3.4 `pin`): phút:giây, giây luôn hai chữ số. */
export function formatCountdown(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Tách câu dẫn quanh địa chỉ email để in đậm email (mẫu v3.4 `pin`) mà không phải cắt bản dịch thành
 * nhiều mảnh: dịch đủ câu với `{email}` = `marker`, rồi cắt tại marker. Không có marker ⇒ cả câu ở `before`.
 */
export function splitAtMarker(text: string, marker: string): { before: string; after: string; found: boolean } {
  const at = marker ? text.indexOf(marker) : -1
  if (at < 0) return { before: text, after: '', found: false }
  return { before: text.slice(0, at), after: text.slice(at + marker.length), found: true }
}

/** HTTP status của lỗi axios-like, hoặc undefined khi không có response (mất mạng/timeout). */
export function errorStatus(e: unknown): number | undefined {
  return (e as ErrLike)?.response?.status
}

/**
 * /register/start trả một trong các mã này ⇒ đường mã PIN chưa dùng được ⇒ lùi về /auth/register cũ.
 * 501 = công tắc backend tắt. 401/403/404/405 = backend CHƯA có endpoint (OTA lên trước backend; endpoint
 * chưa permitAll nên Security trả 401) — thiết kế đòi client merge trước backend vẫn an toàn.
 */
const START_FALLBACK_STATUSES = new Set([401, 403, 404, 405, 501])

export function isVerificationDisabled(e: unknown): boolean {
  const s = errorStatus(e)
  return s !== undefined && START_FALLBACK_STATUSES.has(s)
}

export type VerifyFailure =
  | { key: 'verify.wrongWithRemaining'; remaining: number }
  | {
      key:
        | 'verify.wrong'
        | 'verify.locked'
        | 'verify.expired'
        | 'verify.accountExists'
        | 'verify.tooMany'
        | 'verify.network'
    }

/** Lỗi verify ⇒ khoá câu hiển thị. Email lạ/đã có tài khoản cố ý ra cùng câu với mã sai. */
export function verifyFailure(e: unknown): VerifyFailure {
  const resp = (e as ErrLike)?.response
  if (!resp) return { key: 'verify.network' }
  if (resp.status === 429) return { key: 'verify.tooMany' }
  if (resp.status === 409) return { key: 'verify.accountExists' }
  const reason = resp.data?.extensions?.reason
  if (reason === 'LOCKED') return { key: 'verify.locked' }
  if (reason === 'EXPIRED') return { key: 'verify.expired' }
  const remaining = resp.data?.extensions?.remainingAttempts
  if (typeof remaining === 'number') return { key: 'verify.wrongWithRemaining', remaining }
  return { key: 'verify.wrong' }
}

/** Lỗi ở /register/start (sau khi đã loại 501): 503 = chưa gửi được thư. null = để apiMessage lo. */
export function startFailureKey(e: unknown): 'verify.sendFailed' | 'verify.tooMany' | null {
  const s = errorStatus(e)
  if (s === 503) return 'verify.sendFailed'
  if (s === 429) return 'verify.tooMany'
  return null
}

/**
 * Cờ "đăng ký đã xác minh xong" sống ở mức module: màn đăng ký nằm DƯỚI màn nhập mã trong stack, nên
 * khi nó unmount (sau onboarding) nó phải biết việc đăng ký đã thành công để KHÔNG xoá draft phễu
 * onboarding sắp replay (QA 20/08 F-3). Không đặt cờ khi mới gửi mã: chưa xác minh thì chưa là người dùng.
 */
let verifiedAt: number | null = null
export function markSignupVerified(): void {
  verifiedAt = Date.now()
}
export function wasSignupVerified(): boolean {
  return verifiedAt !== null
}
export function resetSignupVerified(): void {
  verifiedAt = null
}
