import api from '@/lib/api'

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f), 07/11/2026) — `/api/exam-diagnostic`, telc Deutsch B1.
 * Đủ mọi Teil như đề thật (13/11/2026): Lesen 1–3, Sprachbausteine 1–2, Hören 1–3 chấm qua đường luyện đề
 * (`checkPracticeTeil`); Schreiben là đề thật, AI chấm theo phiếu telc (`gradePracticeWriting`); Sprechen là
 * một lượt thi thử phần nói telc B1 với giám khảo AI, làm sau khi bắt đầu bài chẩn đoán.
 */
export type DiagnosticStatus = 'NONE' | 'IN_PROGRESS' | 'DONE'

export interface DiagnosticView {
  status: DiagnosticStatus
  examId: number | null
  /**
   * Khoá Teil theo thứ tự thi thật (`LESEN-1`…`LESEN-3`, `SPRACHBAUSTEINE-1/2`, `HOEREN-1`…`HOEREN-3`,
   * `SCHREIBEN-1`); sau đó là phần Nói. Teil mà đề đã chọn không có thì màn làm bài bỏ qua.
   */
  teile: string[]
  /** Lượt thi nói đã có điểm, làm sau khi bắt đầu; `null` nếu chưa. */
  oral: { sessionId: number; total: number; max: number } | null
  /** Kỹ năng → % — chỉ khi DONE. */
  skills: Partial<Record<'LESEN' | 'HOEREN' | 'SCHREIBEN' | 'SPRECHEN', number>>
  startedAt: string | null
  finishedAt: string | null
  /** Kết quả đã chốt là của bài bản ngắn (chỉ Teil 1 mỗi phần, trước 13/11/2026) ⇒ mời làm lại. */
  shortForm?: boolean
}

export const examDiagnosticApi = {
  get: () => api.get<DiagnosticView>('/exam-diagnostic').then((r) => r.data),
  start: (targetDate: string, dailyMinutes: number) =>
    api.post<DiagnosticView>('/exam-diagnostic/start', { targetDate, dailyMinutes }).then((r) => r.data),
  finish: () => api.post<DiagnosticView>('/exam-diagnostic/finish').then((r) => r.data),
}

export const ORAL_PART = 'SPRECHEN'
