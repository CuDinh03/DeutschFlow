import { AsyncJobError } from '@/lib/asyncJob'

/**
 * Phân loại lỗi của runner luyện (Đợt 0b — trước đây `catch {}` nuốt hết thành "Không thể tải").
 *
 *   conflict      — 409: backend đang giữ một phiên/đề cho kỹ năng này (ConflictException / optimistic lock).
 *   quota         — 429: hết lượt AI (QuotaExceeded) hoặc bị giới hạn tần suất (RATE_LIMITED).
 *   aiUnavailable — 503: nhà cung cấp AI không trả được gì.
 *   jobFailed     — job sinh đề nền FAILED / quá hạn chờ (AsyncJobError).
 *   generic       — mọi thứ còn lại (mạng, 500…).
 */
export type PracticeErrorKind = 'conflict' | 'quota' | 'aiUnavailable' | 'jobFailed' | 'generic'

export interface PracticeErrorInfo {
  kind: PracticeErrorKind
  /** `detail` của ProblemDetail nếu backend có kể — hiện kèm để học viên biết vì sao. */
  detail: string | null
  /** Giây chờ theo `Retry-After` / `retryAfterSeconds` khi bị giới hạn tần suất. */
  retryAfterSeconds: number | null
}

interface HttpLikeError {
  response?: {
    status?: number
    headers?: Record<string, unknown>
    data?: { detail?: unknown; message?: unknown; retryAfterSeconds?: unknown } | null
  }
}

function readDetail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const detail = (data as { detail?: unknown }).detail ?? (data as { message?: unknown }).message
  return typeof detail === 'string' && detail.trim() ? detail : null
}

export function classifyPracticeError(err: unknown): PracticeErrorInfo {
  if (err instanceof AsyncJobError) {
    return { kind: 'jobFailed', detail: err.message || null, retryAfterSeconds: null }
  }
  const response = (err as HttpLikeError | null)?.response
  const status = response?.status
  const detail = readDetail(response?.data)
  if (status === 409) return { kind: 'conflict', detail, retryAfterSeconds: null }
  if (status === 429) {
    const fromBody = Number(response?.data?.retryAfterSeconds)
    const fromHeader = Number(response?.headers?.['retry-after'])
    const retry = Number.isFinite(fromBody) && fromBody > 0 ? fromBody : Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : null
    return { kind: 'quota', detail, retryAfterSeconds: retry }
  }
  if (status === 503) return { kind: 'aiUnavailable', detail, retryAfterSeconds: null }
  return { kind: 'generic', detail, retryAfterSeconds: null }
}
