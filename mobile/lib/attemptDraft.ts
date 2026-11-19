// Nháp của lượt thi thử đang dở (Đợt 4, 19/11/2026). `/mock-exams/{id}/start` trả lượt đang chạy kèm
// nháp đã lưu (có thể làm trên web). Màn giới thiệu nhận nháp và chuyển cho màn làm bài để mở ra
// đúng các câu đã trả lời — nộp bài trống sẽ chấm đè mất bài trên web.

import { anchorFromServer, type ClockAnchor, type ServerClockBody } from './mockRun'

const pending = new Map<number, Record<string, string>>()

/** `answers_json` của nháp → bản đồ câu trả lời (chỉ giữ giá trị chuỗi). Bản sinh đôi của web. */
export function parseDraftAnswers(answersJson: string | null | undefined): Record<string, string> {
  if (!answersJson) return {}
  try {
    const parsed: unknown = JSON.parse(answersJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function rememberAttemptDraft(attemptId: number, answers: Record<string, string>): void {
  if (Object.keys(answers).length > 0) pending.set(attemptId, answers)
}

/** Lấy một lần (lần mở sau của cùng lượt không nạp lại bản cũ). */
export function takeAttemptDraft(attemptId: number): Record<string, string> {
  const answers = pending.get(attemptId) ?? {}
  pending.delete(attemptId)
  return answers
}

// ─── Đợt 4b (19/11/2026): chuyển trọn trạng thái lượt từ `/start` sang màn làm bài ─────────────────
// Ngoài câu trả lời còn có phiên bản nháp (khoá lạc quan của `PATCH …/draft`), phần đang làm
// (`section_index`, có thể do web ghi) và mốc giờ server để đếm ngược.

export interface AttemptStartBody extends ServerClockBody {
  id: number
  draft?: { answers_json?: string | null; section_index?: number | null; version?: number | null } | null
  closed_attempt_id?: number | null
}

export interface AttemptStart {
  answers: Record<string, string>
  version: number
  sectionIndex: number | null
  clock: ClockAnchor | null
  /** Lượt trước của đề này vừa được server chốt "Dừng giữa chừng" vì hết giờ khi vắng mặt. */
  closedPrevious: boolean
}

export function attemptStartFrom(body: AttemptStartBody, clientAtMs: number): AttemptStart {
  return {
    answers: parseDraftAnswers(body.draft?.answers_json),
    version: typeof body.draft?.version === 'number' ? body.draft.version : 0,
    sectionIndex: typeof body.draft?.section_index === 'number' ? body.draft.section_index : null,
    clock: anchorFromServer(body, clientAtMs),
    closedPrevious: typeof body.closed_attempt_id === 'number',
  }
}

const started = new Map<number, AttemptStart>()

export function rememberAttemptStart(body: AttemptStartBody, clientAtMs: number): void {
  started.set(body.id, attemptStartFrom(body, clientAtMs))
}

/** Lấy một lần; mở màn làm bài không qua `/start` thì `null` (không có đồng hồ, nháp từ phiên bản 0). */
export function takeAttemptStart(attemptId: number): AttemptStart | null {
  const s = started.get(attemptId) ?? null
  started.delete(attemptId)
  return s
}
