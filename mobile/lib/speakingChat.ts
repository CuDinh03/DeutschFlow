import type {
  AiChatResponse,
  AiSpeakingSession,
  AiSpeakingMessage,
  ConversationReport,
} from '@/lib/speakingApi'
import type { Reaction } from '@/components/speaking/PersonaStage'

export type ChatRole = 'user' | 'assistant'

export interface ChatTurn {
  role: ChatRole
  content: string
  feedback?: AiChatResponse
}

export type ScreenView = 'select' | 'chat' | 'summary'

// Map an AI turn to a transient persona reaction, gated by session mode.
export function reactionFor(res: AiChatResponse, mode: string | null | undefined): Reaction {
  // Free conversation: no evaluation drama; grammar is surfaced as an end-of-turn note.
  if (mode === 'COMMUNICATION') return null
  // Default to 0.6 (→ "approve") when score is absent, to avoid over-praising.
  const score = res.similarityScore ?? 0.6
  const offTopic =
    (res.status ?? '').toUpperCase() === 'OFF_TOPIC' ||
    (res.action ?? '').toUpperCase().includes('OFF_TOPIC') ||
    (mode === 'INTERVIEW' && score < 0.35)
  if (offTopic) return 'offtopic'
  if (res.correction) return 'wrong'
  if (score >= 0.8) return 'praise'
  if (score >= 0.5) return 'approve'
  return null
}

// Minimal report so the learner always reaches a result screen, even when the
// backend has no AI evaluation to return (LLM/quota hiccup → empty report).
export function emptyConversationReport(session: AiSpeakingSession): ConversationReport {
  return {
    sessionId: session.id,
    topic: session.topic,
    levelEstimate: session.cefrLevel,
    overallScore: null,
    summary: null,
    strengths: [],
    improvements: [],
    grammarAccuracy: null,
    commonErrors: [],
    vocabulary: null,
    fluency: null,
    recommendedNext: [],
    encouragement: null,
  }
}

export function mapMessagesToTurns(messages: AiSpeakingMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const m of messages) {
    const isUser = (m.role ?? '').toUpperCase() === 'USER'
    if (isUser) {
      if (m.userText) turns.push({ role: 'user', content: m.userText })
    } else if (m.aiSpeechDe) {
      turns.push({
        role: 'assistant',
        content: m.aiSpeechDe,
        feedback: {
          aiSpeechDe: m.aiSpeechDe,
          correction: m.correction,
          explanationVi: m.explanationVi,
          grammarPoint: m.grammarPoint,
          feedback: m.assistantFeedback,
          action: m.assistantAction,
          suggestions: [],
        },
      })
    }
  }
  return turns
}

export function phaseLabel(phaseKey: string): string {
  switch (phaseKey) {
    case 'INTRO':
      return 'Giới thiệu'
    case 'ICE_BREAKER':
      return 'Khởi động'
    case 'HARD_SKILLS':
      return 'Chuyên môn'
    case 'STAR_SOFT':
      return 'Kỹ năng mềm'
    case 'CLOSING':
      return 'Kết thúc'
    default:
      return phaseKey
  }
}
