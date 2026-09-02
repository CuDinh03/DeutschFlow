// Client mảng Luyện thi Nói — gương backend `com.deutschflow.examspeaking`
// (ExamSpeakingController, /api/speaking/exam/**) và đồng bộ vocabulary với
// web `frontend/src/lib/examSpeakingApi.ts` + `types/exam-speaking.ts`:
// server là NGUỒN SỰ THẬT (đồng hồ, trạng thái, directive) — client chỉ render
// snapshot ExamSessionView và gửi lượt nói.
//
// Khác ai-speaking: MOCK gửi AUDIO MULTIPART thẳng (server phiên âm verbose và
// phát hành transcript) — KHÔNG transcribe phía client rồi gửi text.

import api from './api'

export type ExamProvider = 'GOETHE' | 'TELC'
export type ExamMode = 'DRILL' | 'MOCK'
export type ExamSessionState =
  | 'PREP' | 'IN_PART' | 'BETWEEN' | 'DONE' | 'GRADING' | 'RESULTS' | 'GRADING_FAILED' | 'ABORTED'

export interface BlueprintPartSummary {
  teilNo: number
  archetype: string
  title: string
  durationSec: number
  flow: string
  hasPartner: boolean
}

export interface BlueprintSummary {
  id: number
  provider: ExamProvider
  level: string
  version: number
  title: string
  prepSec: number
  parts: BlueprintPartSummary[]
  rubricScale: string
  maxTotal: number
  speakingOnlyMin: number
}

export interface ExamDirective {
  teilNo: number
  title: string
  archetype: string
  stepIndex: number
  stepCount: number
  candidateAction: string
  hintVi: string
  stimulus: Record<string, unknown> | null
  prueferText: string | null
  prueferVoice: string | null
  lastAiRole: string | null
  lastAiText: string | null
}

export interface PrepMaterial {
  teilNo: number
  title: string
  archetype: string
  choiceRequired: boolean
  chosenIndex: number | null
  stimuli: Record<string, unknown>[]
}

export interface ExamSessionView {
  id: number
  provider: ExamProvider
  level: string
  mode: ExamMode
  state: ExamSessionState
  currentPart: number
  currentStep: number
  totalParts: number
  serverNow: string
  prepDeadlineAt: string | null
  prepSec: number | null
  prepMaterials: PrepMaterial[] | null
  partDeadlineAt: string | null
  directive: ExamDirective | null
  lastTurnEval: Record<string, unknown> | null
  notesText: string | null
  gradingJobId: number | null
  resultAvailable: boolean
  /** true = phiên ĐANG được ghi âm phục vụ hiệu chuẩn chấm — UI PHẢI nói rõ. */
  retainAudio?: boolean
}

export interface AiTurn { role: string; text: string }

export interface TurnResponse {
  transcript: string
  aiRole: string | null
  aiText: string | null
  aiVoice: string | null
  aiTurns: AiTurn[] | null
  turnEval: Record<string, unknown> | null
  session: ExamSessionView
}

export interface CriterionResult {
  code: string
  label: string
  band: string | null
  points: number
  max: number
  scored: boolean
  evidence: string[]
}

export interface PartResult {
  teilNo: number
  criteria: CriterionResult[]
  points: number
  max: number
  zeroed: boolean
  comment?: string | null
}

export interface ScoreSheet {
  parts: PartResult[]
  global: CriterionResult[]
  total: number
  totalLow: number
  totalHigh: number
  maxPoints: number
  officialMax: number
  passed: boolean | null
  passRule: string
  errors: { code: string; original: string; correction: string; severity: string; teilNo: number }[]
  notes: string[]
}

export interface ExamResultView {
  sessionId: number
  provider: ExamProvider
  level: string
  rubricVersion: number
  total: number | null
  totalLow: number | null
  totalHigh: number | null
  max: number | null
  passed: boolean | null
  scoreSheet: ScoreSheet
  createdAt: string
}

export interface WeaknessContext {
  provider: ExamProvider
  level: string
  teilNo: number
  archetype: string
  count: number
  lastSeenAt: string
}

export interface WeakPointView {
  errorCode: string
  ruleVi: string | null
  examCount: number
  totalCount: number
  openCount: number
  lastSeverity: string | null
  lastSeenAt: string
  exampleOriginal: string | null
  exampleCorrection: string | null
  contexts: WeaknessContext[]
}

export interface RedemittelPackView { archetype: string; phrases: string[] }
export interface WeaknessView { weakPoints: WeakPointView[]; packs: RedemittelPackView[] }

// Trần thời gian theo quy ước aiSpeakingApi (audit R-M2): một lượt chạm AI khi
// Groq nghẽn có thể ~30s phía backend — 45s cho lượt nói, 20s cho thao tác phiên.
const TURN_TIMEOUT_MS = 45_000
const SESSION_TIMEOUT_MS = 20_000

export const examSpeakingApi = {
  listBlueprints: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<BlueprintSummary[]>('/speaking/exam/blueprints', { params }).then((r) => r.data ?? []),

  createSession: (body: { provider: ExamProvider; level: string; mode: ExamMode; teil?: number }) =>
    api
      .post<ExamSessionView>('/speaking/exam/sessions', body, { timeout: SESSION_TIMEOUT_MS })
      .then((r) => r.data),

  getSession: (id: number) =>
    api.get<ExamSessionView>(`/speaking/exam/sessions/${id}`).then((r) => r.data),

  /** Chọn chủ đề cho Teil "1 trong N" (Goethe B1/B2 T2) trong lúc PREP. */
  choose: (id: number, teilNo: number, index: number) =>
    api
      .post<ExamSessionView>(`/speaking/exam/sessions/${id}/choice`, { teilNo, index })
      .then((r) => r.data),

  /**
   * MOCK: lượt nói dạng audio (.m4a của expo-audio) — server phiên âm và trả
   * transcript + các lượt AI kế tiếp. Pattern multipart RN như speakingApi.transcribe.
   */
  audioTurn: (id: number, audioUri: string) => {
    const form = new FormData()
    form.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'turn.m4a',
    } as unknown as Blob)
    return api
      .post<TurnResponse>(`/speaking/exam/sessions/${id}/turns`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { lang: 'vi' },
        timeout: TURN_TIMEOUT_MS,
      })
      .then((r) => r.data)
  },

  advance: (id: number) =>
    api
      .post<ExamSessionView>(`/speaking/exam/sessions/${id}/advance`, undefined, { timeout: SESSION_TIMEOUT_MS })
      .then((r) => r.data),

  finish: (id: number) =>
    api
      .post<ExamSessionView>(`/speaking/exam/sessions/${id}/finish`, undefined, { timeout: SESSION_TIMEOUT_MS })
      .then((r) => r.data),

  /** Chấm lại khi job chấm nền đã chết (state = GRADING_FAILED); trạng thái khác → 409. */
  regrade: (id: number) =>
    api
      .post<ExamSessionView>(`/speaking/exam/sessions/${id}/regrade`, undefined, { timeout: SESSION_TIMEOUT_MS })
      .then((r) => r.data),

  saveNotes: (id: number, notes: string) =>
    api.put<ExamSessionView>(`/speaking/exam/sessions/${id}/notes`, { notes }).then((r) => r.data),

  getResult: (id: number) =>
    api.get<ExamResultView>(`/speaking/exam/sessions/${id}/result`).then((r) => r.data),

  listResults: () => api.get<ExamResultView[]>('/speaking/exam/results').then((r) => r.data ?? []),

  getWeakness: (params?: { provider?: ExamProvider; level?: string }) =>
    api.get<WeaknessView>('/speaking/exam/weakness', { params }).then((r) => r.data),
}
