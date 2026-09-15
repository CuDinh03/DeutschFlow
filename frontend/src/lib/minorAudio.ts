/**
 * 403 `MINOR_AUDIO_BLOCKED` — đường ghi âm bị chặn vì chưa đủ điều kiện về tuổi (DEC-22, D8 10/09).
 *
 * Backend (MinorGate) ném một ProblemDetail 403 từ mọi điểm ghi âm (/ai-speaking/transcribe,
 * /speaking/pronunciation-check, /phoneme/evaluate, /skill-tree/evaluate-pronunciation, lượt nói
 * audio thi nói, /jobs/pronunciation-eval, presigned-url cho tệp audio):
 *
 *   { type: ".../minor-audio-blocked", detail: "<câu tiếng Việt đọc thẳng được>",
 *     extensions: { code: "MINOR_AUDIO_BLOCKED",
 *                   reason: BIRTH_DATE_REQUIRED | GUARDIAN_CONSENT_REQUIRED | GUARDIAN_CONSENT_REVOKED } }
 *
 * KHÔNG mang nhóm tuổi hay ngày sinh — client chọn thông điệp chỉ theo `reason`, và dùng `detail`
 * của server làm nội dung chính (câu chữ client là dự phòng).
 *
 * Vì sao tách khỏi quota/429: hết hạn mức thì người dùng tự xử được (đợi, nạp, nâng gói); còn đây
 * thì nâng gói bao nhiêu cũng vô ích — phải có trung tâm/người giám hộ làm một việc ngoài ứng dụng.
 * Gộp vào phễu nâng cấp là mời một đứa trẻ mua gói để được ghi âm.
 *
 * Thuần, không import axios/api (như systemStatus.ts) → test bằng object trần. Hai lối vào vì hai
 * kiểu gọi mạng đang tồn tại: `parseMinorAudioBlocked` cho lỗi axios, `minorAudioBlockedFromProblem`
 * cho body đọc từ `fetch` trần (PronunciationFeedback).
 */

export const MINOR_AUDIO_BLOCKED_CODE = 'MINOR_AUDIO_BLOCKED'

export type MinorAudioBlockedReason =
  | 'BIRTH_DATE_REQUIRED'
  | 'GUARDIAN_CONSENT_REQUIRED'
  | 'GUARDIAN_CONSENT_REVOKED'

export interface MinorAudioBlocked {
  reason: MinorAudioBlockedReason
  /** `detail` của server — nội dung chính khi có; câu chữ client (i18n) chỉ là dự phòng. */
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
 * Rút thông tin chặn từ BODY problem+json. Nhận diện theo `extensions.code` (hợp đồng chính) hoặc
 * `type` kết thúc bằng `minor-audio-blocked` (dây bảo hiểm nếu extensions bị lược mất).
 * Không phải mã này → null.
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
  // Reason lạ (backend thêm nhánh mới trước khi client kịp cập nhật): vẫn là mã này, vẫn chặn và
  // hiện `detail` của server; tiêu đề dự phòng là nhánh "cần đồng ý" — việc-cần-làm an toàn nhất.
  const reason: MinorAudioBlockedReason = REASONS.has(rawReason)
    ? (rawReason as MinorAudioBlockedReason)
    : 'GUARDIAN_CONSENT_REQUIRED'
  return { reason, detail: str(problem.detail) }
}

/**
 * Đọc lỗi axios (`error.response.data.extensions.code === 'MINOR_AUDIO_BLOCKED'`).
 * Lỗi mạng, 429 quota, 403 thiếu quyền thường, 403 ORG_READ_ONLY… → null — caller giữ luồng cũ.
 */
export function parseMinorAudioBlocked(error: unknown): MinorAudioBlocked | null {
  if (!error || typeof error !== 'object') return null
  const response = (error as { response?: { data?: unknown } }).response
  if (!response || typeof response !== 'object') return null
  return minorAudioBlockedFromProblem(response.data)
}
