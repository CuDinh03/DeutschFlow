// Typed client for the AI Speaking / Interview core engine.
//
// IMPORTANT: these endpoints and payload shapes mirror the backend records
// exactly so iOS, web, and backend share one vocabulary (MVP checklist §1):
//   - InterviewController            GET  /api/interviews/personas
//   - AiSessionController            POST /api/ai-speaking/sessions
//                                    POST /api/ai-speaking/transcribe (multipart)
//                                    POST /api/ai-speaking/sessions/{id}/chat
//                                    PATCH /api/ai-speaking/sessions/{id}/end
//   - InterviewController            GET  /api/interviews/{id}/report
//
// The mobile `api` baseURL already includes `/api`, so paths here are relative
// to that (e.g. `/interviews/personas`). The previous screen called
// `/speaking/sessions` + `/speaking/turn`, which do not exist on the backend.

import * as FileSystem from 'expo-file-system/legacy'
import api from './api'

// Encode binary audio (arraybuffer) to base64 for expo-file-system to write.
// Hermes has no Buffer/btoa, so encode manually.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += B64[b0 >> 2]
    out += B64[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < bytes.length ? B64[b2 & 63] : '='
  }
  return out
}

// ── Domain types (field names match backend DTOs) ───────────────────────────

export type PersonaDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

/** Mirrors backend `SpeakingSessionMode`. */
export type SpeakingSessionMode = 'COMMUNICATION' | 'INTERVIEW' | 'LESSON'

/** Params for creating a session in any of the three modes. */
export interface CreateSessionParams {
  /** Free-text topic: scenario (LESSON), position (INTERVIEW), or "Alltag" (COMMUNICATION). */
  topic: string
  cefrLevel: string
  /** Backend persona code — UPPERCASE of the local persona id (e.g. "LUKAS"). */
  persona: string
  sessionMode: SpeakingSessionMode
  interviewPosition?: string | null
  experienceLevel?: string | null
}

/** Mirrors `InterviewPersonaDto`. Identified by `code` (not a numeric id). */
export interface InterviewPersona {
  code: string
  label: string
  industry: string | null
  roleTitle: string
  tone: string | null
  difficulty: PersonaDifficulty | string
  questionStyle: string | null
  evaluationBias: string | null
  version: number
}

/**
 * Mirrors `AiSpeakingChatResponse.SuggestionDto`. NON_NULL trên wire: LLM bỏ trống field nào
 * thì field đó VẮNG HẲN — germanText/vietnameseTranslation vì vậy KHÔNG được coi là chắc có
 * (bug 04/09: chip "Dùng →" đưa germanText undefined vào typewriter làm sập phòng nói).
 */
export interface SpeakingSuggestion {
  germanText?: string | null
  vietnameseTranslation?: string | null
  level?: string | null
  whyToUse?: string | null
  usageContext?: string | null
  legoStructure?: string | null
}

/** Mirrors `AiSpeakingChatResponse`. NON_NULL on the wire, so most are optional. */
export interface AiChatResponse {
  messageId?: number | null
  sessionId?: number | null
  aiSpeechDe?: string | null
  correction?: string | null
  explanationVi?: string | null
  grammarPoint?: string | null
  feedback?: string | null
  similarityScore?: number | null
  suggestions?: SpeakingSuggestion[]
  /** e.g. OFF_TOPIC — backend signals relevance here, separate from `action`. */
  status?: string | null
  action?: string | null
  isSessionEnded?: boolean | null
  /** INTRO | ICE_BREAKER | HARD_SKILLS | STAR_SOFT | CLOSING */
  interviewPhaseKey?: string | null
  interviewHintKey?: string | null
}

/** Mirrors `AiSpeakingMessageDto` — a persisted turn, used to rehydrate on resume. */
export interface AiSpeakingMessage {
  id: number
  role: string
  userText: string | null
  aiSpeechDe: string | null
  correction: string | null
  explanationVi: string | null
  grammarPoint: string | null
  newWord: string | null
  userInterestDetected: string | null
  assistantAction: string | null
  assistantFeedback: string | null
  createdAt: string | null
}

/** Mirrors `AiSpeakingSessionDto`. */
export interface AiSpeakingSession {
  id: number
  topic: string | null
  cefrLevel: string | null
  persona: string | null
  responseSchema: string | null
  sessionMode: string | null
  status: string | null
  startedAt: string | null
  lastActivityAt: string | null
  endedAt: string | null
  messageCount: number
  initialAiMessage: AiChatResponse | null
  interviewPosition: string | null
  experienceLevel: string | null
  interviewReportJson: string | null
}

/** Mirrors backend `AiSpeakingQuotaDto` (GET /ai-speaking/quota). */
export interface AiSpeakingQuota {
  canStartSession: boolean
  remainingSpendable: number
  planCode: string
  /** true = số liệu là NGÂN SÁCH TRUNG TÂM (kênh staff org — 2 kênh token 26/07), không phải ví cá nhân. */
  orgBudget?: boolean
}

/** Backend phát sentinel này cho pool org không giới hạn (cùng quy ước gói INTERNAL). */
const ORG_BUDGET_UNLIMITED_SENTINEL = 999_999_999

/**
 * Gói/pool không giới hạn — badge số dư nên ẩn thay vì in sentinel 999999999 (audit R-W6/R-M9).
 * Nhánh sentinel CHỈ áp khi {@code orgBudget} (số là pool trung tâm, không bao giờ là ví trả phí)
 * — lo ngại R-W6 "ví ULTRA lớn bị ẩn nhầm vì so ngưỡng" không xảy ra ở đây.
 */
export function isUnlimitedQuota(quota: AiSpeakingQuota | null | undefined): boolean {
  if (!quota) return false
  if (quota.planCode === 'INTERNAL') return true
  return !!quota.orgBudget && quota.remainingSpendable >= ORG_BUDGET_UNLIMITED_SENTINEL
}

/** Mirrors `InterviewReportDto`. */
export interface InterviewPhaseResult {
  phase: string
  score: number | null
  strengths: string[]
  weaknesses: string[]
}

export interface InterviewReport {
  sessionId: number
  position: string | null
  experienceLevel: string | null
  overallScore: number | null
  verdict: string | null
  readinessLevel: string | null
  strongAreas: string[]
  criticalGaps: string[]
  recommendedDrills: string[]
  phaseResults: InterviewPhaseResult[]
}

/** Mirrors `ConversationReportDto` — end-of-session evaluation for COMMUNICATION / LESSON. */
export interface ConversationReport {
  sessionId: number
  topic: string | null
  levelEstimate: string | null
  overallScore: number | null
  summary: string | null
  strengths: string[]
  improvements: string[]
  grammarAccuracy: string | null
  commonErrors: string[]
  vocabulary: string | null
  fluency: string | null
  recommendedNext: string[]
  encouragement: string | null
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

// ── API surface ──────────────────────────────────────────────────────────────

export const speakingApi = {
  /** Active interview-capable personas (shared question banks + difficulty tiers). */
  getPersonas: () =>
    api.get<InterviewPersona[]>('/interviews/personas').then((r) => r.data),

  /**
   * Generalized session start for all three modes (COMMUNICATION / LESSON / INTERVIEW).
   * Mirrors the web `aiSpeakingApi.createSession` payload.
   *
   * (R-M10: xoá `startInterview` — dead code 0 caller với payload cứng cefrLevel="C1".
   * Mọi phiên phỏng vấn nay đi qua `createSession({ sessionMode: 'INTERVIEW', ... })`.)
   */
  createSession: (params: CreateSessionParams) =>
    api
      .post<AiSpeakingSession>(
        '/ai-speaking/sessions',
        {
          topic: params.topic,
          cefrLevel: params.cefrLevel,
          persona: params.persona,
          responseSchema: null,
          sessionMode: params.sessionMode,
          interviewPosition: params.interviewPosition ?? null,
          experienceLevel: params.experienceLevel ?? null,
          assignmentId: null,
        },
        // Backend worst-case khi Groq nghẽn ≈ 30s (semaphore 10s + deadline 20s) — chừa headroom.
        { timeout: 40_000 },
      )
      .then((r) => r.data),

  /**
   * Upload a recorded answer and get the German transcript back.
   *
   * Xoá file .m4a trong finally (F-17 soát 02/09): mỗi lượt nói để lại một file
   * cache không ai dọn — app dùng hằng ngày tích luỹ vô hạn. Xoá ở ĐÂY an toàn vì
   * không caller nào dùng lại uri sau transcribe (speaking/weekly/first-sentence
   * chỉ giữ transcript; skill-practice phát lại bản ghi nhưng KHÔNG transcribe).
   */
  transcribe: async (audioUri: string) => {
    const form = new FormData()
    form.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'answer.m4a',
    } as unknown as Blob)
    try {
      const r = await api.post<{ transcript: string }>('/ai-speaking/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      })
      return r.data.transcript
    } finally {
      void FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {})
    }
  },

  /**
   * Submit a text answer (typed, or a transcript) and get the next AI turn.
   * 45s, not the 15s default (audit R-M2): một lượt LLM khi Groq nghẽn có thể mất tới ~30s
   * phía backend (semaphore 10s + deadline 20s); 15s cũ làm client timeout TRƯỚC server —
   * server vẫn chạy tiếp, vẫn trừ quota, còn user thấy "timeout of 15000ms exceeded".
   */
  chat: (sessionId: number, userMessage: string, clientTurnId?: string) =>
    api
      .post<AiChatResponse>(
        `/ai-speaking/sessions/${sessionId}/chat`,
        // R-M5: gửi khoá idempotency ổn định của lượt này. Client timeout ở 45s nhưng server có thể
        // đã xong (đã trừ quota) — khi user Gửi lại CÙNG khoá, backend trả lại response cũ thay vì
        // gọi LLM + trừ quota lần nữa. retryTurn tái dùng đúng turn.id nên khoá trùng khớp tự nhiên.
        { userMessage, clientTurnId },
        { timeout: 45_000 },
      )
      .then((r) => r.data),

  /**
   * End the session. KHÔNG phải call rẻ: backend chấm điểm tổng kết bằng LLM ĐỒNG BỘ bên trong
   * (INTERVIEW lẫn COMMUNICATION/LESSON) nên cần trần rộng hơn cả chat.
   */
  endSession: (sessionId: number) =>
    api
      .patch<AiSpeakingSession>(`/ai-speaking/sessions/${sessionId}/end`, undefined, { timeout: 60_000 })
      .then((r) => r.data),

  /** Structured, machine-readable interview report for a completed session. */
  getReport: (sessionId: number) =>
    api
      .get<InterviewReport>(`/interviews/${sessionId}/report`, { timeout: 30_000 })
      .then((r) => r.data),

  /** AI evaluation summary for a completed COMMUNICATION / LESSON session. */
  getConversationReport: (sessionId: number) =>
    api
      .get<ConversationReport>(`/ai-speaking/sessions/${sessionId}/report`, { timeout: 30_000 })
      .then((r) => r.data),

  /** Persisted transcript for a session — used to rehydrate after interruption. */
  getMessages: (sessionId: number) =>
    api.get<AiSpeakingMessage[]>(`/ai-speaking/sessions/${sessionId}/messages`).then((r) => r.data),

  /** Recent sessions (most recent first) for the progress/history view. */
  listSessions: (size = 10) =>
    api
      .get<{ content: AiSpeakingSession[] }>('/ai-speaking/sessions', {
        params: { size, sort: 'startedAt,desc' },
      })
      .then((r) => r.data.content ?? []),

  /**
   * Số dư lượt AI của học viên (audit R-M9): hiển thị TRƯỚC khi soạn câu để không đập tường 429 sau
   * khi đã mất công gõ/ghi âm. Chỉ role học viên mới có ý nghĩa; gói nội bộ trả sentinel unlimited.
   */
  getQuota: () =>
    api.get<AiSpeakingQuota>('/ai-speaking/quota').then((r) => r.data),

  /**
   * Server-side TTS (persona voice). Returns base64 MP3 to play via expo-av —
   * no on-device speech module needed. Rejects (503) when the provider isn't
   * configured; callers fall back to on-device speech.
   */
  tts: (text: string, persona: string) =>
    api
      .post('/ai-speaking/tts', { text, persona }, { responseType: 'arraybuffer', timeout: 20_000 })
      .then((r) => arrayBufferToBase64(r.data as ArrayBuffer)),

}
