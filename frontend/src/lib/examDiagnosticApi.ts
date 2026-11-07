import api from '@/lib/api'

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f), 07/11/2026) — `/api/exam-diagnostic`, telc Deutsch B1.
 * Lesen T1, Sprachbausteine T1, Hören T1 chấm qua đường luyện đề (`checkPracticeTeil`); Schreiben là đề
 * thật, AI chấm theo phiếu telc (`gradePracticeWriting`); Sprechen là một lượt thi thử phần nói telc B1
 * với giám khảo AI, làm sau khi bắt đầu bài chẩn đoán.
 */
export type DiagnosticStatus = 'NONE' | 'IN_PROGRESS' | 'DONE'

export interface DiagnosticView {
  status: DiagnosticStatus
  examId: number | null
  /** Khoá Teil theo thứ tự làm (`LESEN-1`, `SPRACHBAUSTEINE-1`, `HOEREN-1`, `SCHREIBEN-1`); sau đó là phần Nói. */
  teile: string[]
  /** Lượt thi nói đã có điểm, làm sau khi bắt đầu; `null` nếu chưa. */
  oral: { sessionId: number; total: number; max: number } | null
  /** Kỹ năng → % — chỉ khi DONE. */
  skills: Partial<Record<'LESEN' | 'HOEREN' | 'SCHREIBEN' | 'SPRECHEN', number>>
  startedAt: string | null
  finishedAt: string | null
}

export const examDiagnosticApi = {
  get: () => api.get<DiagnosticView>('/exam-diagnostic').then((r) => r.data),
  start: (targetDate: string, dailyMinutes: number) =>
    api.post<DiagnosticView>('/exam-diagnostic/start', { targetDate, dailyMinutes }).then((r) => r.data),
  finish: () => api.post<DiagnosticView>('/exam-diagnostic/finish').then((r) => r.data),
}

export const ORAL_PART = 'SPRECHEN'
