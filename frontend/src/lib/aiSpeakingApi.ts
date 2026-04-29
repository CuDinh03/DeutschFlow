import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiSpeakingSession {
  id: number
  topic: string | null
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

// ─── API calls ────────────────────────────────────────────────────────────────

export const aiSpeakingApi = {
  createSession: (topic?: string) =>
    api.post<AiSpeakingSession>('/ai-speaking/sessions', { topic: topic ?? null }),

  chat: (sessionId: number, userMessage: string) =>
    api.post<AiChatResponse>(`/ai-speaking/sessions/${sessionId}/chat`, { userMessage }),

  getMessages: (sessionId: number) =>
    api.get<AiMessage[]>(`/ai-speaking/sessions/${sessionId}/messages`),

  getSessions: (page = 0, size = 10) =>
    api.get<SessionsPage>('/ai-speaking/sessions', { params: { page, size } }),

  endSession: (sessionId: number) =>
    api.patch<AiSpeakingSession>(`/ai-speaking/sessions/${sessionId}/end`),
}
