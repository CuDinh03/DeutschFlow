// Skill-tree node session (lesson content). Mirrors the backend getNodeSession
// shape. Only the learning-content fields the app renders are typed; the
// interactive exercise loop (heterogeneous) is intentionally not modelled here.

import api from './api'

export interface TheoryCard {
  type?: string
  title?: { vi?: string; de?: string }
  content?: { vi?: string; de?: string }
  tags?: string[]
}

export interface NodeVocabItem {
  id: string
  german: string
  meaning: string
  gender?: string | null
  gender_label?: string | null
  example_de?: string
  example_vi?: string
  tags?: string[]
}

export interface NodePhrase {
  german: string
  meaning: string
}

// Exercise items embedded in content_json. The four common shapes; unknown
// types are ignored by the runner.
export interface ExerciseBase {
  id: string
  type: string
  question_vi?: string
  question?: string
}
export interface ExerciseMultipleChoice extends ExerciseBase {
  type: 'MULTIPLE_CHOICE'
  options: string[]
  correct: number
}
export interface ExerciseFillBlank extends ExerciseBase {
  type: 'FILL_BLANK'
  sentence_de?: string
  hint_vi?: string
  answer: string
  accept_also?: string[]
}
export interface ExerciseTranslate extends ExerciseBase {
  type: 'TRANSLATE'
  from?: string
  sentence: string
  answer: string
  accept_also?: string[]
}
export interface ExerciseReorder extends ExerciseBase {
  type: 'REORDER'
  words: string[]
  correct_order: string[]
  translation?: string
}
export type Exercise =
  | ExerciseMultipleChoice
  | ExerciseFillBlank
  | ExerciseTranslate
  | ExerciseReorder
  | ExerciseBase

export interface NodeContent {
  title?: { de?: string; vi?: string }
  overview?: { de?: string; vi?: string }
  theory_cards?: TheoryCard[]
  vocabulary?: NodeVocabItem[]
  phrases?: NodePhrase[]
  exercises?: { theory_gate?: Exercise[]; practice?: Exercise[] }
}

export interface NodeSession {
  nodeId: number
  titleDe: string
  titleVi: string
  descriptionVi: string | null
  emoji: string | null
  cefrLevel: string | null
  xpReward: number | null
  sessionType: string | null
  content: NodeContent | null
  hasContent: boolean
  dependenciesMet: boolean
  userStatus: string // LOCKED | AVAILABLE | IN_PROGRESS | COMPLETED
}

export interface NodeSubmitResult {
  scorePercent?: number
  completed?: boolean
  xpEarned?: number
  status?: string
  attempts?: number
}

export const skillTreeApi = {
  getNodeSession: (nodeId: number | string) =>
    api.get<NodeSession>(`/skill-tree/node/${nodeId}/session`).then((r) => r.data),

  // Backend trusts the client-computed score_percent (it doesn't re-grade items).
  submitNode: (nodeId: number | string, scorePercent: number) =>
    api
      .post<NodeSubmitResult>(`/skill-tree/${nodeId}/submit`, { score_percent: scorePercent })
      .then((r) => r.data),
}

// ── Local grading helpers (for the scored MC + FILL_BLANK items) ────────────

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
}

export function isFillCorrect(input: string, ex: ExerciseFillBlank): boolean {
  const n = normalizeAnswer(input)
  if (!n) return false
  if (normalizeAnswer(ex.answer) === n) return true
  return (ex.accept_also ?? []).some((a) => normalizeAnswer(a) === n)
}

export function isReorderCorrect(order: string[], ex: ExerciseReorder): boolean {
  return normalizeAnswer(order.join(' ')) === normalizeAnswer(ex.correct_order.join(' '))
}
