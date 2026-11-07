import api from '@/lib/api'

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f), 07/11/2026) — `/api/exam-diagnostic`.
 * Ba Teil khách quan làm và chấm qua đường luyện đề (`checkPracticeTeil`); Viết và Nói tự đánh giá.
 */
export type DiagnosticStatus = 'NONE' | 'IN_PROGRESS' | 'DONE'
export type DiagnosticSelfSkill = 'SCHREIBEN' | 'SPRECHEN'

export interface DiagnosticView {
  status: DiagnosticStatus
  examId: number | null
  /** Khoá Teil theo thứ tự làm (`LESEN-1`, `SPRACHBAUSTEINE-1`, `HOEREN-1`). */
  teile: string[]
  self: Partial<Record<DiagnosticSelfSkill, number>>
  /** Kỹ năng → % — chỉ khi DONE. */
  skills: Partial<Record<'LESEN' | 'HOEREN' | 'SCHREIBEN' | 'SPRECHEN', number>>
  selfRated: string[]
  finishedAt: string | null
}

export const examDiagnosticApi = {
  get: () => api.get<DiagnosticView>('/exam-diagnostic').then((r) => r.data),
  start: (targetDate: string, dailyMinutes: number) =>
    api.post<DiagnosticView>('/exam-diagnostic/start', { targetDate, dailyMinutes }).then((r) => r.data),
  saveSelf: (skill: DiagnosticSelfSkill, level: number) =>
    api.put<DiagnosticView>('/exam-diagnostic/self', { skill, level }).then((r) => r.data),
  finish: () => api.post<DiagnosticView>('/exam-diagnostic/finish').then((r) => r.data),
}

export const SELF_SKILLS: DiagnosticSelfSkill[] = ['SCHREIBEN', 'SPRECHEN']
