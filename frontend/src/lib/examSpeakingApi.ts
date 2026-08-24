import api from '@/lib/api'
import type {
  BlueprintSummary,
  WeaknessView,
  ExamMode,
  ExamProvider,
  ExamResultView,
  ExamSessionView,
  TurnResponse,
} from '@/types/exam-speaking'

/** API mảng Luyện thi Nói — `/api/speaking/exam/**` (backend Đợt 0). */
export const examSpeakingApi = {
  listBlueprints: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<BlueprintSummary[]>('/speaking/exam/blueprints', { params }),

  createSession: (body: { provider: ExamProvider; level: string; mode: ExamMode; teil?: number; prepMode?: 'SHORT' | 'FULL' }) =>
    api.post<ExamSessionView>('/speaking/exam/sessions', body),

  /** Chọn chủ đề cho Teil "1 trong N" (Goethe B1/B2 T2): trong PREP hoặc ngay đầu Teil. */
  choose: (id: number, teilNo: number, index: number) =>
    api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/choice`, { teilNo, index }),

  getSession: (id: number) => api.get<ExamSessionView>(`/speaking/exam/sessions/${id}`),

  /** Drill (hoặc dev): lượt nói dạng text. */
  textTurn: (id: number, transcript: string) =>
    api.post<TurnResponse>(`/speaking/exam/sessions/${id}/turns`, { transcript }),

  /** Mock (và drill có mic): lượt nói dạng audio — server phiên âm verbose. */
  audioTurn: (id: number, blob: Blob, filename = 'turn.webm') => {
    const form = new FormData()
    form.append('audio', blob, filename)
    return api.post<TurnResponse>(`/speaking/exam/sessions/${id}/turns`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  advance: (id: number) => api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/advance`),
  finish: (id: number) => api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/finish`),
  saveNotes: (id: number, notes: string) => api.put<ExamSessionView>(`/speaking/exam/sessions/${id}/notes`, { notes }),
  getResult: (id: number) => api.get<ExamResultView>(`/speaking/exam/sessions/${id}/result`),
  listResults: () => api.get<ExamResultView[]>('/speaking/exam/results'),

  /** Đợt 5a — màn Ôn yếu điểm: yếu điểm theo dạng bài + gói Redemittel. */
  getWeakness: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<WeaknessView>('/speaking/exam/weakness', { params }),
}
