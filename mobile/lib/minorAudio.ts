// 403 `MINOR_AUDIO_BLOCKED` — đường ghi âm bị chặn vì chưa đủ điều kiện về tuổi (DEC-22, D8 10/09).
//
// Backend (MinorGate) ném một ProblemDetail 403:
//   { type: ".../minor-audio-blocked", detail: "<câu tiếng Việt đọc thẳng được>",
//     extensions: { code: "MINOR_AUDIO_BLOCKED", reason: BIRTH_DATE_REQUIRED | GUARDIAN_CONSENT_REQUIRED
//                                                        | GUARDIAN_CONSENT_REVOKED } }
// từ mọi điểm ghi âm: /ai-speaking/transcribe, /speaking/pronunciation-check, /phoneme/evaluate,
// /skill-tree/evaluate-pronunciation, lượt nói audio thi nói, /jobs/pronunciation-eval, presigned-url
// (audio). KHÔNG mang nhóm tuổi hay ngày sinh — client chọn thông điệp chỉ theo `reason`.
//
// Vì sao KHÔNG gộp vào quota/upsell: hết hạn mức thì người dùng tự xử được (đợi, nạp, nâng gói);
// còn đây thì nâng gói bao nhiêu cũng vô ích — phải có trung tâm/người giám hộ làm một việc ngoài
// ứng dụng. Ba `reason` là ba việc khác hẳn nhau, và REVOKED tuyệt đối không được biến thành lời mời
// "đồng ý lại" tự động.
//
// Thuần, không import store/api (giống lib/maintenance.ts + lib/quota.ts) → test được bằng object
// trần. Phần hiển thị nằm ở components/MinorAudioBlockedSheet.tsx (host mount MỘT lần ở root
// layout); mã màn hình chỉ gọi `presentMinorAudioBlocked(error)` — cùng lối cầu nối như aiConsent.
// ⚠️ aiConsent là cờ ĐỒNG Ý DÙNG AI trên máy (App Store 5.1.1); đồng ý của người giám hộ là chuyện
// khác hẳn (ghi ở server, do trung tâm thu) — KHÔNG trộn hai luồng.

export const MINOR_AUDIO_BLOCKED_CODE = 'MINOR_AUDIO_BLOCKED'

export type MinorAudioBlockedReason =
  | 'BIRTH_DATE_REQUIRED'
  | 'GUARDIAN_CONSENT_REQUIRED'
  | 'GUARDIAN_CONSENT_REVOKED'

export interface MinorAudioBlocked {
  reason: MinorAudioBlockedReason
  /** `detail` của server — nội dung chính khi có; thông điệp client chỉ là dự phòng. */
  detail: string | null
}

const REASONS: ReadonlySet<string> = new Set<MinorAudioBlockedReason>([
  'BIRTH_DATE_REQUIRED',
  'GUARDIAN_CONSENT_REQUIRED',
  'GUARDIAN_CONSENT_REVOKED',
])

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Rút thông tin chặn từ BODY problem+json (không cần bọc axios). Nhận diện theo
 * `extensions.code` (hợp đồng chính) hoặc `type` kết thúc bằng `minor-audio-blocked` (dây bảo hiểm
 * nếu extensions bị proxy nào đó lược mất). Không phải mã này → null.
 */
export function minorAudioBlockedFromProblem(data: unknown): MinorAudioBlocked | null {
  if (!data || typeof data !== 'object') return null
  const problem = data as { type?: unknown; detail?: unknown; extensions?: unknown }
  const ext =
    problem.extensions && typeof problem.extensions === 'object'
      ? (problem.extensions as { code?: unknown; reason?: unknown })
      : null
  const byCode = ext?.code === MINOR_AUDIO_BLOCKED_CODE
  const byType = typeof problem.type === 'string' && problem.type.endsWith('minor-audio-blocked')
  if (!byCode && !byType) return null
  const rawReason = typeof ext?.reason === 'string' ? ext.reason : ''
  // Reason lạ (backend thêm nhánh mới trước khi client kịp cập nhật): vẫn là mã này, vẫn phải chặn
  // và hiện `detail` của server; chọn nhánh "cần đồng ý" làm tiêu đề dự phòng vì đó là việc-cần-làm
  // an toàn nhất (không bao giờ là lời mời nâng gói).
  const reason: MinorAudioBlockedReason = REASONS.has(rawReason)
    ? (rawReason as MinorAudioBlockedReason)
    : 'GUARDIAN_CONSENT_REQUIRED'
  return { reason, detail: str(problem.detail) }
}

/**
 * Đọc lỗi axios (`error.response.data.extensions.code === 'MINOR_AUDIO_BLOCKED'`).
 * Lỗi mạng, 429 quota, 403 thiếu quyền thường… → null, caller giữ nguyên luồng cũ.
 */
export function parseMinorAudioBlocked(error: unknown): MinorAudioBlocked | null {
  if (!error || typeof error !== 'object') return null
  const response = (error as { response?: { status?: unknown; data?: unknown } }).response
  if (!response || typeof response !== 'object') return null
  return minorAudioBlockedFromProblem(response.data)
}

// ── Câu chữ ──────────────────────────────────────────────────────────────────
// App mobile hiện tiếng Việt cứng (không có catalog i18n) — cùng nếp với upsell.ts / AiConsentSheet.

export interface MinorAudioCopy {
  eyebrow: string
  title: string
  body: string
  /** Nói rõ nâng gói KHÔNG mở được — kẻo một đứa trẻ đi tìm nút "Nâng cấp". */
  note: string
}

const FALLBACK: Record<MinorAudioBlockedReason, { title: string; body: string }> = {
  BIRTH_DATE_REQUIRED: {
    title: 'Trung tâm chưa ghi nhận ngày sinh của bạn',
    body:
      'Tài khoản chưa có ngày sinh nên hệ thống chưa xác định được có cần đồng ý của người giám hộ ' +
      'hay không, và không gửi bản ghi âm đi khi còn chưa rõ. Hãy liên hệ trung tâm để bổ sung ngày ' +
      'sinh vào hồ sơ học viên.',
  },
  GUARDIAN_CONSENT_REQUIRED: {
    title: 'Cần phiếu đồng ý của cha mẹ/người giám hộ',
    body:
      'Tài khoản này cần đồng ý của cha mẹ hoặc người giám hộ trước khi ghi âm giọng nói. Hãy liên ' +
      'hệ trung tâm để hoàn tất phiếu đồng ý; sau khi trung tâm ghi nhận, phần luyện nói mở lại ngay.',
  },
  GUARDIAN_CONSENT_REVOKED: {
    title: 'Đồng ý ghi âm đã được thu hồi',
    body:
      'Đồng ý cho phép ghi âm của tài khoản này đã được thu hồi, nên phần luyện nói tạm thời không ' +
      'dùng được. Nếu muốn mở lại, người giám hộ liên hệ trung tâm để cấp lại đồng ý.',
  },
}

export const MINOR_AUDIO_EYEBROW = 'Phần luyện nói tạm khoá'
export const MINOR_AUDIO_NOTE =
  'Nâng cấp gói không mở được phần này — chỉ trung tâm hoặc người giám hộ mới mở lại được. ' +
  'Bạn vẫn dùng được mọi phần không cần ghi âm.'

/** Câu chữ hiển thị: tiêu đề theo `reason`; nội dung = `detail` server nếu có, dự phòng nếu không. */
export function minorAudioCopy(info: MinorAudioBlocked): MinorAudioCopy {
  const fb = FALLBACK[info.reason]
  return { eyebrow: MINOR_AUDIO_EYEBROW, title: fb.title, body: info.detail ?? fb.body, note: MINOR_AUDIO_NOTE }
}

// ── Cầu nối tới host hiển thị ────────────────────────────────────────────────
// MinorAudioBlockedHost (root layout) đăng ký presenter lúc mount; mã màn hình chỉ gọi
// presentMinorAudioBlocked(error) trong catch — không cần import sheet hay giữ state riêng.

export interface PresentOptions {
  /**
   * Hiện nút "Liên hệ trung tâm" (điều hướng sang màn lớp). Tắt ở màn không được rời (onboarding
   * first-sentence: rời màn giữa chừng là bỏ dở luồng chào mừng).
   */
  contact?: boolean
}

type Presenter = (info: MinorAudioBlocked, options: Required<PresentOptions>) => void

let presenter: Presenter | null = null

export function registerMinorAudioBlockedPresenter(p: Presenter | null): void {
  presenter = p
}

/**
 * Nếu `error` là 403 MINOR_AUDIO_BLOCKED → mở sheet giải thích + trả true (caller DỪNG, đừng hiện
 * Alert chung, đừng giữ lượt để "Gửi lại" — gửi lại không mở được cổng này). Không phải → false,
 * caller đi tiếp luồng lỗi cũ. Chưa có host (root layout chưa mount) → cũng trả false: Alert cũ
 * đọc `detail` của server (apiMessage ưu tiên detail) nên người dùng vẫn thấy đúng câu — chỉ thiếu
 * lối liên hệ, còn hơn nuốt lỗi im lặng.
 */
export function presentMinorAudioBlocked(error: unknown, options: PresentOptions = {}): boolean {
  const info = parseMinorAudioBlocked(error)
  if (!info || !presenter) return false
  presenter(info, { contact: options.contact ?? true })
  return true
}
