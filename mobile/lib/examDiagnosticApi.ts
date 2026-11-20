// Bài chẩn đoán đầu vào của Luyện thi — bản sinh đôi của `frontend/src/lib/examDiagnosticApi.ts`.

import api from './api'

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
