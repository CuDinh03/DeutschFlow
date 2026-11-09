/**
 * Lượt thi thử trọn đề (06/11/2026) cho luồng luyện thi mới — dùng lại NGUYÊN engine lượt thi cũ
 * (`/api/mock-exams/{id}/start` · `…/attempts/{id}/draft` · `/finish` · `/result`) để giữ lịch sử,
 * hai ngưỡng đỗ telc, ngân sách điểm và số liệu kế hoạch thi; app mobile vẫn gọi đúng các endpoint này.
 *
 * Khác trình thi cũ: nộp bài thì CHỜ job chấm xong (poll `/async-jobs`) rồi mới mở kết quả, và màn
 * kết quả đọc thêm phân tích từng câu ở `/mock-exams/practice/attempts/{id}/analysis`.
 */
import api, { httpStatus, isAxiosErr } from '@/lib/api'
import { waitForAsyncJob } from '@/lib/asyncJob'
import { isAttemptAlreadyFinished } from '@/lib/mockExamFinish'
import { classifyDraftSaveError, parseDraftAnswers, type DraftSaveResult } from '@/lib/exam/examDraftSync'
import type { ExamGate } from '@/components/exam/telc/examGates'
import type { ExamBudget } from '@/components/exam/telc/examBudget'
import type { ItemAiAnswer, PracticeTeilResult, WritingEvaluation } from '@/lib/telcPracticeApi'

export interface StartedAttempt {
  attemptId: number
  examId: number
  /** Đề đã gỡ đáp án, dạng chuỗi JSON (cùng dạng `sectionsJson` của chế độ luyện). */
  sectionsJson: string
  remainingSeconds: number
  answers: Record<string, string>
  sectionIndex: number
  draftVersion: number
  /** Câu "đánh dấu xem lại" đã lưu cùng nháp (B3, V374). */
  flags: string[]
  /** Lượt trước của đề này vừa được server chốt "Dừng giữa chừng" vì quá giờ khi vắng mặt. */
  closedAttemptId: number | null
}

interface StartResponse {
  id: number
  exam_id?: number
  sections_json?: unknown
  time_limit_minutes?: number
  remaining_seconds?: number
  draft?: { answers_json?: string | null; section_index?: number | null; version: number; flags?: string[] | null }
  closed_attempt_id?: number | null
}

function asJsonString(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  try {
    return JSON.stringify(raw)
  } catch {
    return null
  }
}

/** Bắt đầu hoặc làm tiếp (POST /start idempotent khi đang có lượt IN_PROGRESS). */
export async function startAttempt(examId: number): Promise<StartedAttempt> {
  const { data } = await api.post<StartResponse>(`/mock-exams/${examId}/start`)
  let sections = asJsonString(data?.sections_json)
  if (!sections) {
    const q = await api.get<{ sections_json?: unknown }>(`/mock-exams/${examId}/questions`)
    sections = asJsonString(q.data?.sections_json)
  }
  if (!sections) throw new Error('NO_CONTENT')
  const minutes = typeof data?.time_limit_minutes === 'number' ? data.time_limit_minutes : 150
  return {
    attemptId: data.id,
    examId: data.exam_id ?? examId,
    sectionsJson: sections,
    remainingSeconds: typeof data?.remaining_seconds === 'number' ? data.remaining_seconds : minutes * 60,
    answers: parseDraftAnswers(data?.draft?.answers_json),
    sectionIndex: typeof data?.draft?.section_index === 'number' ? data.draft.section_index : 0,
    draftVersion: data?.draft?.version ?? 0,
    flags: parseFlags(data?.draft?.flags),
    closedAttemptId: typeof data?.closed_attempt_id === 'number' ? data.closed_attempt_id : null,
  }
}

export function parseFlags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x !== '') : []
}

/** PATCH …/draft — kết quả theo union của autosaver (`examDraftSync`). `flags` thiếu ⇒ server giữ giá trị cũ. */
export async function saveAttemptDraft(
  attemptId: number,
  payload: { answers: Record<string, string>; sectionIndex: number; flags?: string[] },
  baseVersion: number,
): Promise<DraftSaveResult> {
  try {
    const res = await api.patch(`/mock-exams/attempts/${attemptId}/draft`, {
      answers: payload.answers,
      sectionIndex: payload.sectionIndex,
      ...(payload.flags ? { flags: payload.flags } : {}),
      baseVersion,
    })
    const data = res.data as { version?: number; remaining_seconds?: number | null }
    return {
      kind: 'saved',
      version: typeof data?.version === 'number' ? data.version : baseVersion + 1,
      remainingSeconds: typeof data?.remaining_seconds === 'number' ? data.remaining_seconds : null,
    }
  } catch (err) {
    if (isAxiosErr(err) && err.response) return classifyDraftSaveError(httpStatus(err), err.response.data)
    return { kind: 'error' }
  }
}

/**
 * Nộp bài và chờ chấm xong. `alreadyFinished` = lượt này đã nộp trước đó (bấm hai lần, tab khác,
 * hết giờ) — người gọi mở thẳng kết quả thay vì báo lỗi.
 */
export async function finishAttempt(
  attemptId: number,
  answers: Record<string, string>,
): Promise<{ alreadyFinished: boolean }> {
  try {
    const { data } = await api.post<{ jobId?: string }>(`/mock-exams/attempts/${attemptId}/finish`, { answers })
    if (data?.jobId) await waitForAsyncJob(data.jobId, { timeoutMs: 240_000 })
    return { alreadyFinished: false }
  } catch (err) {
    if (isAttemptAlreadyFinished(err)) return { alreadyFinished: true }
    throw err
  }
}

export interface AttemptResult {
  id: number
  exam_id?: number | null
  exam_title?: string
  title?: string
  started_at?: string
  finished_at?: string
  total_score?: number | null
  passed?: boolean | null
  status: string
  detailed_scores_json?: string | null
  gates?: ExamGate[]
  budget?: ExamBudget | null
}

export async function getAttemptResult(attemptId: number): Promise<AttemptResult> {
  const { data } = await api.get<AttemptResult>(`/mock-exams/attempts/${attemptId}/result`)
  return data
}

export interface AttemptAnalysis {
  attemptId: number
  examId: number
  sectionsJson: string
  teile: PracticeTeilResult[]
  writingText: string | null
  writing: WritingEvaluation | null
}

export async function getAttemptAnalysis(attemptId: number): Promise<AttemptAnalysis> {
  const { data } = await api.get<AttemptAnalysis>(`/mock-exams/practice/attempts/${attemptId}/analysis`)
  return data
}

export interface MyAttempt {
  id: number
  exam_id: number
  exam_title?: string
  started_at: string
  finished_at?: string
  total_score?: number | null
  passed?: boolean | null
  status: string
  /** Điểm từng phần (chuỗi JSON); lượt `PARTIAL` có khối `partial` + `teile` — đọc bằng `partialInfo`. */
  detailed_scores_json?: string | null
}

/** Lịch sử lượt thi, gồm cả lượt "Dừng giữa chừng" (`PARTIAL`, chỉ web mới xin; mobile không thấy). */
export async function listMyAttempts(): Promise<MyAttempt[]> {
  const { data } = await api.get<MyAttempt[]>('/mock-exams/attempts/me', { params: { includePartial: true } })
  return Array.isArray(data) ? data : []
}

export const PARTIAL = 'PARTIAL'

export type PartialTeilStatus = 'SCORED' | 'NOT_ATTEMPTED' | 'WRITTEN_NOT_GRADED'

export interface PartialTeil {
  key: string
  status: PartialTeilStatus
  score: number | null
  max: number | null
  answered: number
  total: number
}

export interface PartialInfo {
  reason: 'STOPPED' | 'EXPIRED' | string | null
  teileDone: number
  teileCounted: number
  teileTotal: number
  teile: PartialTeil[]
}

/**
 * Lượt dừng giữa chừng (07/11/2026): chỉ Teil đã chạm ≥ 1 câu có điểm, Viết dở không chấm, không
 * tổng điểm, không đỗ/trượt. Đọc từ `detailed_scores_json` (`partial` + `teile`); `null` nếu không phải.
 */
export function partialInfo(detailedJson: string | null | undefined): PartialInfo | null {
  if (!detailedJson) return null
  try {
    const parsed = JSON.parse(detailedJson) as {
      partial?: { reason?: string; teile_done?: number; teile_counted?: number; teile_total?: number }
      teile?: Record<string, { status?: string; score?: number; max?: number; answered?: number; total?: number }>
    }
    if (!parsed?.partial) return null
    const teile = Object.entries(parsed.teile ?? {}).map(([key, v]): PartialTeil => ({
      key,
      status: (v.status ?? 'NOT_ATTEMPTED') as PartialTeilStatus,
      score: typeof v.score === 'number' ? v.score : null,
      max: typeof v.max === 'number' ? v.max : null,
      answered: v.answered ?? 0,
      total: v.total ?? 0,
    }))
    return {
      reason: parsed.partial.reason ?? null,
      teileDone: parsed.partial.teile_done ?? teile.filter((x) => x.status !== 'NOT_ATTEMPTED').length,
      teileCounted: parsed.partial.teile_counted ?? teile.filter((x) => x.status === 'SCORED').length,
      teileTotal: parsed.partial.teile_total ?? teile.length,
      teile,
    }
  } catch {
    return null
  }
}

export interface StopResult {
  attemptId: number
  status: 'PARTIAL' | 'CANCELLED' | string
  alreadyClosed: boolean
}

/**
 * Dừng lượt thi giữa chừng: server chấm theo Teil các Teil đã chạm và dừng đồng hồ. Không chạm câu nào
 * ⇒ `CANCELLED` (lượt bị huỷ, không vào lịch sử). Gọi lại trên lượt đã đóng ⇒ `alreadyClosed`.
 */
export async function stopAttempt(attemptId: number, answers: Record<string, string>): Promise<StopResult> {
  const { data } = await api.post<{ attempt_id: number; status: string; already_closed?: boolean }>(
    `/mock-exams/attempts/${attemptId}/stop`,
    { answers },
  )
  return { attemptId: data.attempt_id, status: data.status, alreadyClosed: !!data.already_closed }
}

/** Điểm từng phần đọc từ `detailed_scores_json` của lượt thi. */
export function sectionScores(detailedJson: string | null | undefined): Record<string, { total: number; max: number; status?: string }> {
  if (!detailedJson) return {}
  try {
    const parsed = JSON.parse(detailedJson) as Record<string, { total?: number; max?: number; status?: string }>
    const out: Record<string, { total: number; max: number; status?: string }> = {}
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (v && typeof v === 'object' && typeof v.max === 'number') out[k] = { total: v.total ?? 0, max: v.max, status: v.status }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * "Hỏi AI về câu này" cho một câu của lượt thi thử đã nộp / dừng giữa chừng (B3). Lượt của người khác 404,
 * lượt đang làm 409, hết lượt AI 429.
 */
export async function askAttemptItemAi(attemptId: number, teilKey: string, itemId: string, locale: string): Promise<ItemAiAnswer> {
  const { data } = await api.post<ItemAiAnswer>(
    `/mock-exams/practice/attempts/${attemptId}/teile/${encodeURIComponent(teilKey)}/items/${encodeURIComponent(itemId)}/ask-ai`,
    { locale },
  )
  return data
}
