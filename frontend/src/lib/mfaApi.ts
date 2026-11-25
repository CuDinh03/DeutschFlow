import api, { httpStatus, isAxiosErr, problemCode } from '@/lib/api'

/**
 * Xác thực hai lớp (TOTP) cho tài khoản ADMIN — hợp đồng với backend (`AuthController` /api/auth/mfa/*,
 * `MfaProfileController`, `AdminMfaController`, 09/11/2026).
 *
 * `POST /auth/login` trả HAI dạng body (cùng HTTP 200): `AuthResponse` như cũ, hoặc thử thách 2FA
 * `{ mfaRequired: true, mfaToken, enrolled, emailHint }` — KHÔNG có token/role, KHÔNG đặt cookie. Client
 * KHÔNG được gọi `setTokens` với thử thách; đi tiếp bằng `mfaToken` (JWT typ=mfa, sống 5 phút).
 */

export interface MfaChallenge {
  mfaRequired: true
  mfaToken: string
  /** false → luồng bật 2FA (mã email → QR → mã đầu tiên); true → nhập mã 6 số / mã khôi phục. */
  enrolled: boolean
  /** "a***@x.com" — email nhận mã. */
  emailHint: string
}

/** Dạng tối thiểu của AuthResponse mà luồng đăng nhập cần. */
export interface AuthSession {
  accessToken: string
  refreshToken?: string | null
  userId: number
  email: string
  role: string
  locale?: string | null
  orgId?: number | null
  orgRole?: string | null
}

export interface EmailCodeSent {
  emailHint: string
  expiresInSeconds: number
}

export interface EnrollmentStart {
  /**
   * `otpauth://totp/<issuer>:<email>?secret=…&issuer=<issuer>…` — dựng QR từ chuỗi này. Issuer theo môi trường
   * (`MFA_ISSUER`, production "myDeutschFlow").
   */
  otpauthUri: string
  secretBase32: string
  /** Token thử thách MỚI — token cũ đã bị đốt, phải thay ngay. */
  mfaToken: string
}

export interface EnrollmentResult {
  recoveryCodes: string[]
  session: AuthSession
}

export interface MfaStatus {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesRemaining: number
}

/** Mã lỗi backend (`extensions.code`) — giữ đồng bộ với `MfaException`. */
export const MFA_ERROR = {
  REQUIRED: 'MFA_REQUIRED',
  REQUIRED_USE_LOGIN: 'MFA_REQUIRED_USE_LOGIN',
  NOT_CONFIGURED: 'MFA_NOT_CONFIGURED',
  TOKEN_INVALID: 'MFA_TOKEN_INVALID',
  CODE_INVALID: 'MFA_CODE_INVALID',
  /** Mã đúng nhưng của bước 30 giây đã dùng — không tính lần sai; chờ mã mới. */
  CODE_ALREADY_USED: 'MFA_CODE_ALREADY_USED',
  ALREADY_ENABLED: 'MFA_ALREADY_ENABLED',
  NOT_ENROLLED: 'MFA_NOT_ENROLLED',
  ENROLLMENT_NOT_STARTED: 'MFA_ENROLLMENT_NOT_STARTED',
  EMAIL_UNAVAILABLE: 'MFA_EMAIL_UNAVAILABLE',
  RESET_SELF_FORBIDDEN: 'MFA_RESET_SELF_FORBIDDEN',
  UNLOCK_SELF_FORBIDDEN: 'MFA_UNLOCK_SELF_FORBIDDEN',
} as const

/** Phân loại lỗi 2FA để giao diện chọn câu. 429 (quá số lần sai) đi chung mã `RATE_LIMITED`. */
export type MfaErrorKind =
  | 'codeInvalid'
  | 'codeAlreadyUsed'
  | 'rateLimited'
  | 'expired'
  | 'notConfigured'
  | 'emailUnavailable'
  | 'alreadyEnabled'
  | 'notEnrolled'
  | 'other'

export function mfaErrorKind(e: unknown): MfaErrorKind {
  if (httpStatus(e) === 429) return 'rateLimited'
  switch (problemCode(e)) {
    case MFA_ERROR.CODE_INVALID:
      return 'codeInvalid'
    case MFA_ERROR.CODE_ALREADY_USED:
      return 'codeAlreadyUsed'
    case MFA_ERROR.TOKEN_INVALID:
      return 'expired'
    case MFA_ERROR.NOT_CONFIGURED:
      return 'notConfigured'
    case MFA_ERROR.EMAIL_UNAVAILABLE:
      return 'emailUnavailable'
    case MFA_ERROR.ALREADY_ENABLED:
      return 'alreadyEnabled'
    case MFA_ERROR.NOT_ENROLLED:
    case MFA_ERROR.ENROLLMENT_NOT_STARTED:
      return 'notEnrolled'
    default:
      return 'other'
  }
}

/**
 * Số giây còn phải chờ của một 429 (quá số lần sai): `extensions.retryAfterSeconds`, rồi header `Retry-After`.
 * Backend tính theo cửa sổ trượt — lần sai cũ nhất rời cửa sổ là mở lại, không phải luôn 15 phút. `null` khi
 * không phải 429 hoặc không đọc được.
 */
export function mfaRetryAfterSeconds(e: unknown): number | null {
  if (httpStatus(e) !== 429 || !isAxiosErr(e)) return null
  const body = e.response?.data as { extensions?: { retryAfterSeconds?: unknown } } | undefined
  const fromBody = Number(body?.extensions?.retryAfterSeconds)
  if (Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody)
  const fromHeader = Number(e.response?.headers?.['retry-after'])
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.ceil(fromHeader)
  return null
}

/** Thời gian chờ để hiển thị: dưới 1 phút tính bằng giây, còn lại làm tròn LÊN phút. */
export function mfaWaitParts(seconds: number): { unit: 'seconds' | 'minutes'; count: number } {
  const s = Math.max(1, Math.ceil(seconds))
  return s < 60 ? { unit: 'seconds', count: s } : { unit: 'minutes', count: Math.ceil(s / 60) }
}

/** Body của `/auth/login` là thử thách 2FA (không phải phiên)? */
export function isMfaChallenge(data: unknown): data is MfaChallenge {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { mfaRequired?: unknown }).mfaRequired === true &&
    typeof (data as { mfaToken?: unknown }).mfaToken === 'string'
  )
}

/** Nội dung tệp .txt mã khôi phục tải về. */
export function recoveryCodesFile(header: string, codes: string[]): string {
  return [header, '', ...codes.map((c, i) => `${String(i + 1).padStart(2, ' ')}. ${c}`), ''].join('\n')
}

export const mfaApi = {
  sendEmailCode(mfaToken: string) {
    return api.post<EmailCodeSent>('/auth/mfa/email-code', { mfaToken })
  },
  startEnrollment(mfaToken: string, emailCode: string) {
    return api.post<EnrollmentStart>('/auth/mfa/enroll/start', { mfaToken, emailCode })
  },
  confirmEnrollment(mfaToken: string, code: string) {
    return api.post<EnrollmentResult>('/auth/mfa/enroll/confirm', { mfaToken, code })
  },
  verify(mfaToken: string, factor: { code: string } | { recoveryCode: string }) {
    return api.post<AuthSession>('/auth/mfa/verify', { mfaToken, ...factor })
  },
  status() {
    return api.get<MfaStatus>('/profile/me/mfa')
  },
  regenerateRecoveryCodes(code: string) {
    return api.post<{ recoveryCodes: string[] }>('/profile/me/mfa/recovery-codes', { code })
  },
  /** Gỡ khoá NHẬP SAI 2FA của người khác (không đụng bí mật/mã khôi phục/phiên). */
  adminUnlock(userId: number, reason: string) {
    return api.post<{ userId: number; clearedFailures: number }>(`/admin/users/${userId}/mfa/unlock`, { reason })
  },
  adminReset(userId: number, reason: string) {
    return api.post<{ userId: number; hadMfa: boolean; revokedSessions: number }>(
      `/admin/users/${userId}/mfa/reset`,
      { reason },
    )
  },
}
