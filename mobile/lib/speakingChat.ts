import type {
  AiChatResponse,
  AiSpeakingSession,
  AiSpeakingMessage,
  ConversationReport,
} from '@/lib/speakingApi'
import type { Reaction } from '@/components/speaking/PersonaStage'

export type ChatRole = 'user' | 'assistant'

/** Vòng đời gửi 1 lượt user ở luồng live (MB-3 / R-M3). Turn đã persist (server/assistant) để undefined. */
export type TurnStatus = 'sending' | 'sent' | 'failed'

export interface ChatTurn {
  /** clientTurnId — key render ổn định + để cập nhật TRÚNG turn (thay vì quét "user gần nhất"). */
  id: string
  role: ChatRole
  content: string
  feedback?: AiChatResponse
  /** Chỉ có ý nghĩa cho user turn ở luồng live; undefined = đã settle. */
  status?: TurnStatus
  /** Chỉ dùng khi status==='failed': lỗi thoáng qua (mạng/timeout/5xx) mới nên tự/mời thử lại. */
  retryable?: boolean
}

export type ScreenView = 'select' | 'chat' | 'summary'

// ─── Helpers thuần cho outbox lượt speaking (MB-3) — tách khỏi speaking.tsx để jest test trực tiếp ──

let _turnSeq = 0
/** Id client ổn định cho 1 turn. Counter (không Date.now) → deterministic trong test + đủ unique/list. */
export function newTurnId(): string {
  _turnSeq += 1
  return `t-${_turnSeq}`
}

/** Tạo user turn ở trạng thái đang gửi (optimistic). */
export function makeUserTurn(content: string): ChatTurn {
  return { id: newTurnId(), role: 'user', content, status: 'sending' }
}

/** Đổi status của đúng turn theo id (immutable). retryable chỉ giữ khi 'failed'. */
export function setTurnStatus(
  turns: ChatTurn[],
  id: string,
  status: TurnStatus,
  retryable?: boolean,
): ChatTurn[] {
  return turns.map((t) =>
    t.id === id ? { ...t, status, retryable: status === 'failed' ? retryable : undefined } : t,
  )
}

/** Gắn feedback vào ĐÚNG turn theo id (thay cho vòng quét "user gần nhất"). */
export function attachFeedbackToTurn(turns: ChatTurn[], id: string, feedback: AiChatResponse): ChatTurn[] {
  return turns.map((t) => (t.id === id ? { ...t, feedback } : t))
}

/** R-M5: transcript server đã chứa đúng câu này chưa (dedupe theo nội dung trim) — chống re-POST double-charge. */
export function serverHasUserText(serverTurns: ChatTurn[], content: string): boolean {
  const needle = content.trim()
  return serverTurns.some((t) => t.role === 'user' && t.content.trim() === needle)
}

/**
 * Resume-merge: server là chân lý cho mọi turn ĐÃ persist, nhưng GIỮ lại các user turn FAILED (chưa
 * lên server, không trùng transcript) để user còn Gửi lại. Câu failed mà thực ra đã lên server (timeout
 * nhưng đã lưu) sẽ trùng → bị loại → không nhân đôi.
 */
export function mergeFailedTurns(serverTurns: ChatTurn[], prevTurns: ChatTurn[]): ChatTurn[] {
  const orphans = prevTurns.filter(
    (t) => t.role === 'user' && t.status === 'failed' && !serverHasUserText(serverTurns, t.content),
  )
  return orphans.length ? [...serverTurns, ...orphans] : serverTurns
}

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
      // Server là chân lý → id theo vị trí trong lần fetch (ổn định trong lần render đó). Turn từ
      // server đã persist nên KHÔNG set status (undefined = đã settle).
      if (m.userText) turns.push({ id: `srv-u-${turns.length}`, role: 'user', content: m.userText })
    } else if (m.aiSpeechDe) {
      // Correction is persisted on the assistant row but describes the learner's previous turn —
      // attach it to the most recent user turn so it renders under the user bubble (matches the live
      // flow). Suggestions are not persisted, so the assistant turn carries an empty list on resume.
      if (m.correction) {
        for (let k = turns.length - 1; k >= 0; k--) {
          if (turns[k].role === 'user') {
            turns[k] = {
              ...turns[k],
              feedback: {
                correction: m.correction,
                explanationVi: m.explanationVi,
                grammarPoint: m.grammarPoint,
              },
            }
            break
          }
        }
      }
      turns.push({
        id: `srv-a-${turns.length}`,
        role: 'assistant',
        content: m.aiSpeechDe,
        feedback: {
          aiSpeechDe: m.aiSpeechDe,
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
