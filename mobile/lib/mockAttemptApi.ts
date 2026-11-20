// Lời gọi API của lượt thi thử trọn đề mà màn làm bài và màn kết quả dùng thêm ở Đợt 4b (19/11/2026).
// Cùng endpoint web đang gọi (`frontend/src/lib/exam/mockAttemptApi.ts`):
//   PATCH /mock-exams/attempts/{id}/draft             — tự lưu nháp (khoá lạc quan baseVersion, V285)
//   GET   /mock-exams/practice/attempts/{id}/analysis — phân tích từng câu của lượt đã chấm
//   POST  /mock-exams/attempts/{id}/stop              — dừng giữa chừng: chấm theo Teil đã làm (Đợt 4e)
// Phần quyết định (phân loại lỗi, đồng hồ) nằm ở `mockRun.ts` để test được trong jest.

import api from './api'
import { classifyDraftSaveError, parseDraftSaved, type DraftPayload, type DraftSaveResult } from './mockRun'
import { parseStopResult, type StopResult } from './mockStop'
import type { PracticeTeilResult, WritingEvaluation } from './telcPracticeApi'

/** Lưu nháp; KHÔNG ném lỗi — mọi kết cục thành một `DraftSaveResult`. Không gửi `flags` ⇒ server giữ cờ đang lưu. */
export async function saveAttemptDraft(attemptId: number, payload: DraftPayload, baseVersion: number): Promise<DraftSaveResult> {
  try {
    const res = await api.patch(`/mock-exams/attempts/${attemptId}/draft`, {
      answers: payload.answers,
      sectionIndex: payload.sectionIndex,
      ...(payload.flags ? { flags: payload.flags } : {}),
      baseVersion,
    })
    return parseDraftSaved(res.data, baseVersion)
  } catch (err) {
    const res = (err as { response?: { status?: number; data?: unknown } } | null)?.response
    return classifyDraftSaveError(res?.status, res?.data)
  }
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

export const attemptAnalysisKey = (attemptId: number) => ['mock-attempt-analysis', attemptId] as const

/** Dừng lượt giữa chừng (như web `stopAttempt`). Không chạm câu nào ⇒ `CANCELLED`; lượt đã đóng ⇒ `alreadyClosed`. */
export async function stopAttempt(attemptId: number, answers: Record<string, string>): Promise<StopResult> {
  const { data } = await api.post(`/mock-exams/attempts/${attemptId}/stop`, { answers })
  return parseStopResult(data)
}
