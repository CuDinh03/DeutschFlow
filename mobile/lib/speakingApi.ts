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

/** Mirrors `AiSpeakingChatResponse.SuggestionDto`. */
export interface SpeakingSuggestion {
  germanText: string
  vietnameseTranslation: string
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

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Backend interview `experienceLevel` enum: 0-6M | 6-12M | 1-2Y | 3Y | 5Y. */
export function experienceForDifficulty(difficulty: string): string {
  switch (difficulty) {
    case 'BEGINNER':
      return '0-6M'
    case 'ADVANCED':
      return '3Y'
    case 'INTERMEDIATE':
    default:
      return '1-2Y'
  }
}

// ── API surface ──────────────────────────────────────────────────────────────

export const speakingApi = {
  /** Active interview-capable personas (shared question banks + difficulty tiers). */
  getPersonas: () =>
    api.get<InterviewPersona[]>('/interviews/personas').then((r) => r.data),

  /**
   * Start a mock-interview speaking session for the given persona.
   * Matches the web `CompanionSelect` INTERVIEW payload: topic = role,
   * cefrLevel = "C1", sessionMode = "INTERVIEW".
   */
  startInterview: (persona: InterviewPersona) =>
    api
      .post<AiSpeakingSession>(
        '/ai-speaking/sessions',
        {
          topic: persona.roleTitle,
          cefrLevel: 'C1',
          persona: persona.code,
          responseSchema: null,
          sessionMode: 'INTERVIEW',
          interviewPosition: persona.roleTitle,
          experienceLevel: experienceForDifficulty(persona.difficulty),
          assignmentId: null,
        },
        { timeout: 30_000 },
      )
      .then((r) => r.data),

  /**
   * Generalized session start for all three modes (COMMUNICATION / LESSON / INTERVIEW).
   * Mirrors the web `aiSpeakingApi.createSession` payload.
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
        { timeout: 30_000 },
      )
      .then((r) => r.data),

  /** Upload a recorded answer and get the German transcript back. */
  transcribe: (audioUri: string) => {
    const form = new FormData()
    form.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'answer.m4a',
    } as unknown as Blob)
    return api
      .post<{ transcript: string }>('/ai-speaking/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      })
      .then((r) => r.data.transcript)
  },

  /** Submit a text answer (typed, or a transcript) and get the next AI turn. */
  chat: (sessionId: number, userMessage: string) =>
    api
      .post<AiChatResponse>(`/ai-speaking/sessions/${sessionId}/chat`, { userMessage })
      .then((r) => r.data),

  /** End the session; in INTERVIEW mode this triggers report generation. */
  endSession: (sessionId: number) =>
    api
      .patch<AiSpeakingSession>(`/ai-speaking/sessions/${sessionId}/end`)
      .then((r) => r.data),

  /** Structured, machine-readable interview report for a completed session. */
  getReport: (sessionId: number) =>
    api.get<InterviewReport>(`/interviews/${sessionId}/report`).then((r) => r.data),

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
   * Server-side TTS (persona voice). Returns base64 MP3 to play via expo-av —
   * no on-device speech module needed. Rejects (503) when the provider isn't
   * configured; callers fall back to on-device speech.
   */
  tts: (text: string, persona: string) =>
    api
      .post('/ai-speaking/tts', { text, persona }, { responseType: 'arraybuffer', timeout: 20_000 })
      .then((r) => arrayBufferToBase64(r.data as ArrayBuffer)),

}
