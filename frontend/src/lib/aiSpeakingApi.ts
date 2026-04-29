import api from './api'
import { getAccessToken } from './authSession'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiSpeakingSession {
  id: number
  topic: string | null
  cefrLevel: string | null
  status: 'ACTIVE' | 'ENDED'
  startedAt: string
  lastActivityAt: string | null
  endedAt: string | null
  messageCount: number
}

export interface LearningStatus {
  newWord: string | null
  userInterestDetected: string | null
}

export interface AiChatResponse {
  messageId: number
  sessionId: number
  aiSpeechDe: string
  correction: string | null
  explanationVi: string | null
  grammarPoint: string | null
  learningStatus: LearningStatus
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
  createdAt: string
}

export interface SessionsPage {
  content: AiSpeakingSession[]
  totalElements: number
  totalPages: number
  number: number
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/** Base URL without /api prefix, for raw fetch with SSE */
const API_BASE =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:8080/api'

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
  const token = getAccessToken()

  fetch(`${API_BASE}/ai-speaking/sessions/${sessionId}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({ userMessage }),
    signal: ctrl.signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`)
        return
      }

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })

        // Process complete SSE frames (delimited by double newline)
        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''

        for (const frame of frames) {
          if (!frame.trim()) continue
          const lines = frame.split('\n')
          let eventName = ''
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            if (line.startsWith('data:')) data = line.slice(5).trim()
          }
          if (eventName === 'token' && data) {
            onToken(data)
          } else if (eventName === 'done' && data) {
            try {
              onDone(JSON.parse(data) as AiChatResponse)
            } catch {
              onError('Failed to parse done payload')
            }
          } else if (eventName === 'error' && data) {
            onError(data)
          }
        }
      }
    })
    .catch((err) => {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message ?? 'Stream error')
      }
    })

  return ctrl
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const aiSpeakingApi = {
  createSession: (topic?: string, cefrLevel?: string) =>
    api.post<AiSpeakingSession>('/ai-speaking/sessions', { topic: topic ?? null, cefrLevel: cefrLevel ?? null }),

  chat: (sessionId: number, userMessage: string) =>
    api.post<AiChatResponse>(`/ai-speaking/sessions/${sessionId}/chat`, { userMessage }),

  transcribe: (audioBlob: Blob) => {
    const fd = new FormData()
    fd.append('audio', audioBlob, 'voice.webm')
    return api.post<{ transcript: string }>('/ai-speaking/transcribe', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getMessages: (sessionId: number) =>
    api.get<AiMessage[]>(`/ai-speaking/sessions/${sessionId}/messages`),

  getSessions: (page = 0, size = 10) =>
    api.get<SessionsPage>('/ai-speaking/sessions', { params: { page, size } }),

  endSession: (sessionId: number) =>
    api.patch<AiSpeakingSession>(`/ai-speaking/sessions/${sessionId}/end`),
}
