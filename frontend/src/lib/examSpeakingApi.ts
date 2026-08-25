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

/**
 * API mảng Luyện thi Nói — `/api/speaking/exam/**` (backend Đợt 0).
 *
 * Timeout: axios mặc định 8s — QUÁ NGẮN cho lượt nói (upload + Whisper + LLM + câu partner;
 * tail thật đo được >6,5s ngay cả đường text). Vượt trần là client tự hủy (banner "Kết nối
 * chậm") trong khi backend VẪN xử lý xong ⇒ client mất response, transcript lệch. Các call
 * chạm AI dùng trần riêng theo quy ước aiSpeakingApi (30–45s).
 */
const TURN_TIMEOUT_MS = 45_000
const SESSION_TIMEOUT_MS = 20_000

export const examSpeakingApi = {
  listBlueprints: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<BlueprintSummary[]>('/speaking/exam/blueprints', { params }),

  createSession: (body: { provider: ExamProvider; level: string; mode: ExamMode; teil?: number; prepMode?: 'SHORT' | 'FULL' }) =>
    api.post<ExamSessionView>('/speaking/exam/sessions', body, { timeout: SESSION_TIMEOUT_MS }),

  /** Chọn chủ đề cho Teil "1 trong N" (Goethe B1/B2 T2): trong PREP hoặc ngay đầu Teil. */
  choose: (id: number, teilNo: number, index: number) =>
    api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/choice`, { teilNo, index }),

  getSession: (id: number) => api.get<ExamSessionView>(`/speaking/exam/sessions/${id}`),

  /** Drill (hoặc dev): lượt nói dạng text. `lang` = locale UI — ngôn ngữ lời giải thích quickEval. */
  textTurn: (id: number, transcript: string, lang?: string) =>
    api.post<TurnResponse>(`/speaking/exam/sessions/${id}/turns`, { transcript }, { params: lang ? { lang } : undefined, timeout: TURN_TIMEOUT_MS }),

  /** Mock (và drill có mic): lượt nói dạng audio — server phiên âm verbose. */
  audioTurn: (id: number, blob: Blob, filename = 'turn.webm', lang?: string) => {
    const form = new FormData()
    form.append('audio', blob, filename)
    return api.post<TurnResponse>(`/speaking/exam/sessions/${id}/turns`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: lang ? { lang } : undefined,
      timeout: TURN_TIMEOUT_MS,
    })
  },

  advance: (id: number) => api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/advance`, undefined, { timeout: SESSION_TIMEOUT_MS }),
  finish: (id: number) => api.post<ExamSessionView>(`/speaking/exam/sessions/${id}/finish`, undefined, { timeout: SESSION_TIMEOUT_MS }),
  saveNotes: (id: number, notes: string) => api.put<ExamSessionView>(`/speaking/exam/sessions/${id}/notes`, { notes }),
  getResult: (id: number) => api.get<ExamResultView>(`/speaking/exam/sessions/${id}/result`),
  listResults: () => api.get<ExamResultView[]>('/speaking/exam/results'),

  /** Đợt 5a — màn Ôn yếu điểm: yếu điểm theo dạng bài + gói Redemittel. */
  getWeakness: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<WeaknessView>('/speaking/exam/weakness', { params }),
}
