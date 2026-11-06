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
import type { PracticeTeilResult, WritingEvaluation } from '@/lib/telcPracticeApi'

export interface StartedAttempt {
  attemptId: number
  examId: number
  /** Đề đã gỡ đáp án, dạng chuỗi JSON (cùng dạng `sectionsJson` của chế độ luyện). */
  sectionsJson: string
  remainingSeconds: number
  answers: Record<string, string>
  sectionIndex: number
  draftVersion: number
}

interface StartResponse {
  id: number
  exam_id?: number
  sections_json?: unknown
  time_limit_minutes?: number
  remaining_seconds?: number
  draft?: { answers_json?: string | null; section_index?: number | null; version: number }
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
  }
}

/** PATCH …/draft — kết quả theo union của autosaver (`examDraftSync`). */
export async function saveAttemptDraft(
  attemptId: number,
  payload: { answers: Record<string, string>; sectionIndex: number },
  baseVersion: number,
): Promise<DraftSaveResult> {
  try {
    const res = await api.patch(`/mock-exams/attempts/${attemptId}/draft`, {
      answers: payload.answers,
      sectionIndex: payload.sectionIndex,
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
}

export async function listMyAttempts(): Promise<MyAttempt[]> {
  const { data } = await api.get<MyAttempt[]>('/mock-exams/attempts/me')
  return Array.isArray(data) ? data : []
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
