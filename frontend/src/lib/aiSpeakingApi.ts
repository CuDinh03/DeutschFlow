import axios from 'axios'
import api from './api'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './authSession'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Must match backend {@code SpeakingPersona} names. */
export type SpeakingPersonaId = 'DEFAULT' | 'LUKAS' | 'EMMA' | 'HANNA' | 'KLAUS'

/** Parallel JSON contracts (backend SpeakingResponseSchema). */
export type SpeakingResponseSchemaId = 'V1' | 'V2'

/** Matches backend SpeakingSessionMode. */
export type SpeakingSessionMode = 'COMMUNICATION' | 'INTERVIEW' | 'LESSON'

/** Experience level for interview mode. */
export type ExperienceLevel = '0-6M' | '6-12M' | '1-2Y' | '3Y' | '5Y'

export interface AiSpeakingQuota {
  canStartSession: boolean
  remainingSpendable: number
  planCode: string
}

export interface AiSpeakingSession {
  id: number
  topic: string | null
  cefrLevel: string | null
  /** Tutor persona for this session (Module 10). */
  persona: SpeakingPersonaId | string | null
  /** V1 = full tutor JSON; V2 = compact content/translation/feedback/action. */
  responseSchema: SpeakingResponseSchemaId | string | null
  /** COMMUNICATION (default) vs INTERVIEW (simulated job/study interview). */
  sessionMode?: SpeakingSessionMode | string | null
  status: 'ACTIVE' | 'ENDED'
  startedAt: string
  lastActivityAt: string | null
  endedAt: string | null
  messageCount: number
  initialAiMessage?: AiChatResponse | null
  /** Interview mode: position applied for. */
  interviewPosition?: string | null
  /** Interview mode: candidate experience level. */
  experienceLevel?: string | null
  /** Interview mode: JSON evaluation report (populated on endSession). */
  interviewReportJson?: string | null
}

export interface LearningStatus {
  newWord: string | null
  userInterestDetected: string | null
}

/** Structured error from AI (canonical error_code whitelist on backend) */
export interface ErrorItem {
  errorCode: string
  severity: string
  confidence: number | null
  wrongSpan: string | null
  correctedSpan: string | null
  ruleViShort: string | null
  exampleCorrectDe: string | null
}

/** Adaptive hints from backend (`meta.adaptive` on chat / SSE done). */
export interface AdaptiveMeta {
  enabled: boolean
  cefrEffective: string
  difficultyKnob: number
  focusCodes: string[]
  targetStructures: string[]
  topicSuggestion: string | null
  forceRepairBeforeContinue: boolean
  primaryRepairErrorCode: string | null
}

export interface Suggestion {
  german_text: string
  vietnamese_translation: string
  level: string
  why_to_use: string
  usage_context: string
  lego_structure: string
}

export interface AiChatResponse {
  messageId: number
  sessionId: number
  aiSpeechDe: string
  correction: string | null
  explanationVi: string | null
  grammarPoint: string | null
  learningStatus: LearningStatus
  errors: ErrorItem[]
  adaptive?: AdaptiveMeta | null
  
  // New fields
  status?: 'OFF_TOPIC' | 'ON_TOPIC_NEEDS_IMPROVEMENT' | 'EXCELLENT' | null
  similarityScore?: number | null
  feedback?: string | null
  suggestions?: Suggestion[]
  responseSchema?: SpeakingResponseSchemaId | string | null
  /** V2: suggested next step / question */
  action?: string | null
}

export interface AiMessage {
  id: number
  role: 'USER' | 'ASSISTANT'
  userText: string | null
  aiSpeechDe: string | null
  correction: string | null
  explanationVi: string | null
  grammarPoint: string | null
  newWord: string | null
  userInterestDetected: string | null
  assistantAction?: string | null
  assistantFeedback?: string | null
  createdAt: string
  /** Present on newer API responses; empty array when none */
  errors?: ErrorItem[]
}

export interface SessionsPage {
  content: AiSpeakingSession[]
  totalElements: number
  totalPages: number
  number: number
}

/** Passed to onError when refresh fails or no refresh token — page should not fallback */
export const AI_SPEAKING_UNAUTHORIZED = 'unauthorized'

/** Stream idle timeout — map to `speaking.errors.streamStalled` in the UI */
export const AI_SPEAKING_STREAM_STALLED = 'STREAM_STALLED'

// ─── Streaming helpers ────────────────────────────────────────────────────────

/** Base URL without /api prefix, for raw fetch with SSE */
const API_BASE = '/api'


const STALL_MS = 45_000

/**
 * Incrementally extracts the JSON string value of `field` (e.g. ai_speech_de) from streamed
 * Groq deltas that append to a growing JSON object. Emits only newly visible German text.
 */
function createSpeechStreamer(field: string): (delta: string) => string {
  let buf = ''
  let openIdx = -1
  let cursor = 0
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keyRe = new RegExp(`"${escapedField}"\\s*:\\s*"`)

  return (delta: string): string => {
    buf += delta
    if (openIdx < 0) {
      const m = keyRe.exec(buf)
      if (!m) return ''
      openIdx = m.index + m[0].length
    }
    let i = openIdx + cursor
    let out = ''
    while (i < buf.length) {
      const ch = buf[i]
      if (ch === '\\' && i + 1 < buf.length) {
        const esc = buf[i + 1]
        const map: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          n: '\n',
          t: '\t',
          r: '\r',
          b: '\b',
          f: '\f',
        }
        if (esc in map) {
          out += map[esc]
          i += 2
          continue
        }
        if (esc === 'u' && i + 6 <= buf.length) {
          const hex = buf.slice(i + 2, i + 6)
          const code = parseInt(hex, 16)
          if (!Number.isNaN(code)) {
            out += String.fromCharCode(code)
            i += 6
            continue
          }
        }
        break
      }
      if (ch === '"') break
      out += ch
      i += 1
    }
    cursor = i - openIdx
    return out
  }
}

function buildStreamHeaders(accessToken: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  }
  if (accessToken) h.Authorization = `Bearer ${accessToken}`
  return h
}

function parseSseDataLines(lines: string[]): { eventName: string; data: string } {
  let eventName = ''
  const dataParts: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      const rest = line.slice(5)
      const payload = rest.startsWith(' ') ? rest.slice(1) : rest
      dataParts.push(payload)
    }
  }
  return { eventName, data: dataParts.join('\n') }
}

/**
 * Streams a chat response via SSE.
 * Calls onToken for each content delta, onDone with the full metadata once finished.
 *
 * @returns AbortController — call ctrl.abort() to cancel early.
 */
export function chatStream(
  sessionId: number,
  userMessage: string,
  onToken: (delta: string) => void,
  onDone: (meta: AiChatResponse) => void,
  onError: (err: string) => void
): AbortController {
  const ctrl = new AbortController()
  const url = `${API_BASE}/ai-speaking/sessions/${sessionId}/chat/stream`
  const body = JSON.stringify({ userMessage })

  let settled = false
  let stallTimer: ReturnType<typeof setTimeout> | null = null

  const clearStall = () => {
    if (stallTimer) {
      clearTimeout(stallTimer)
      stallTimer = null
    }
  }

  const bumpStall = (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    clearStall()
    stallTimer = setTimeout(() => {
      void reader.cancel().catch(() => {})
      if (!settled) {
        settled = true
        onError(AI_SPEAKING_STREAM_STALLED)
      }
    }, STALL_MS)
  }

  const finishOk = () => {
    settled = true
    clearStall()
  }

  void (async () => {
    try {
      const doFetch = (accessToken: string | null) =>
        fetch(url, {
          method: 'POST',
          headers: buildStreamHeaders(accessToken),
          body,
          signal: ctrl.signal,
        })

      let res = await doFetch(getAccessToken())

      if (res.status === 401) {
        const rt = getRefreshToken()
        if (!rt) {
          if (!settled) {
            settled = true
            onError(AI_SPEAKING_UNAUTHORIZED)
          }
          return
        }
        try {
          const { data } = await axios.post<{ accessToken?: string; refreshToken?: string | null }>(
            '/api/auth/refresh',
            { refreshToken: rt }
          )
          setTokens(data)
          const newToken = data.accessToken ?? null
          res = await doFetch(newToken)
        } catch {
          clearTokens()
          if (typeof window !== 'undefined') window.location.href = '/login'
          if (!settled) {
            settled = true
            onError(AI_SPEAKING_UNAUTHORIZED)
          }
          return
        }
      }

      if (res.status === 401) {
        clearTokens()
        if (typeof window !== 'undefined') window.location.href = '/login'
        if (!settled) {
          settled = true
          onError(AI_SPEAKING_UNAUTHORIZED)
        }
        return
      }

      if (!res.ok || !res.body) {
        if (!settled) {
          settled = true
          onError(`HTTP ${res.status}`)
        }
        return
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      const speechStreamer = createSpeechStreamer('ai_speech_de')

      bumpStall(reader)

      const dispatchFrame = (frame: string) => {
        if (!frame.trim()) return
        const frameLines = frame.split('\n')
        const { eventName, data } = parseSseDataLines(frameLines)

        if (eventName === 'token' && data) {
          const visible = speechStreamer(data)
          if (visible) onToken(visible)
        } else if (eventName === 'done' && data) {
          try {
            onDone(JSON.parse(data) as AiChatResponse)
            finishOk()
          } catch (e) {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
              console.warn('[chatStream] Failed to parse done payload', e)
            }
            if (!settled) {
              settled = true
              clearStall()
              onError('Failed to parse done payload')
            }
          }
        } else if (eventName === 'error' && data) {
          if (!settled) {
            settled = true
            clearStall()
            onError(data)
          }
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        bumpStall(reader)
        buf += dec.decode(value, { stream: true })

        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''

        for (const frame of frames) {
          dispatchFrame(frame)
        }
      }

      if (buf.trim()) {
        dispatchFrame(buf)
      }

      clearStall()
      if (!settled && !ctrl.signal.aborted) {
        settled = true
        onError('Stream ended without a complete response')
      }
    } catch (err: unknown) {
      if (settled) return
      const e = err as Error
      if (e.name === 'AbortError') return
      const msg =
        e instanceof TypeError && e.message === 'Failed to fetch'
          ? 'Network error or backend unreachable'
          : e.message ?? 'Stream error'
      settled = true
      clearStall()
      onError(msg)
    }
  })()

  return ctrl
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const aiSpeakingApi = {
  getQuota: () => api.get<AiSpeakingQuota>('/ai-speaking/quota'),

  createSession: (
    topic?: string,
    cefrLevel?: string,
    persona?: SpeakingPersonaId | string,
    responseSchema?: SpeakingResponseSchemaId | string,
    sessionMode?: SpeakingSessionMode | string | null,
    interviewPosition?: string | null,
    experienceLevel?: ExperienceLevel | string | null,
  ) =>
    api.post<AiSpeakingSession>('/ai-speaking/sessions', {
      topic: topic ?? null,
      cefrLevel: cefrLevel ?? null,
      persona: persona ?? null,
      responseSchema: responseSchema ?? null,
      sessionMode: sessionMode ?? null,
      interviewPosition: interviewPosition ?? null,
      experienceLevel: experienceLevel ?? null,
    }),

  chat: (sessionId: number, userMessage: string) =>
    api.post<AiChatResponse>(`/ai-speaking/sessions/${sessionId}/chat`, { userMessage }),

  transcribe: (audioBlob: Blob) => {
    const mime = String(audioBlob.type || '').toLowerCase()
    const ext =
      mime.includes('mp4') || mime.includes('m4a')
        ? 'mp4'
        : mime.includes('ogg')
          ? 'ogg'
          : mime.includes('webm')
            ? 'webm'
            : 'webm'
    const filename = `voice.${ext}`
    const fd = new FormData()
    fd.append('audio', audioBlob, filename)
    const token = getAccessToken()
    return api.post<{ transcript: string }>('/ai-speaking/transcribe', fd, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Ensure axios doesn't keep JSON content-type for multipart requests
        'Content-Type': undefined as unknown as string,
      },
    })
  },

  getMessages: (sessionId: number) =>
    api.get<AiMessage[]>(`/ai-speaking/sessions/${sessionId}/messages`),

  getSessions: (page = 0, size = 10) =>
    api.get<SessionsPage>('/ai-speaking/sessions', { params: { page, size } }),

  endSession: (sessionId: number) =>
    api.patch<AiSpeakingSession>(`/ai-speaking/sessions/${sessionId}/end`),
}
