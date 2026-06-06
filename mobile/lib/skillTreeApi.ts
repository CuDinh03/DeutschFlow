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

// ── Skill-tree list (/skill-tree/me) ────────────────────────────────────────
// The endpoint returns raw snake_case rows (queryForList Map). Map to camelCase;
// `tags` arrives as a JSON text string, `status` is under `user_status`, and the
// title is split into title_vi/title_de.

export type NodeStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'

export interface RawSkillNode {
  id: number
  title_de?: string | null
  title_vi?: string | null
  cefr_level?: string | null
  day_number?: number | null
  user_status?: string | null
  status?: string | null
  tags?: string | string[] | null
}

export interface SkillNode {
  id: number
  title: string
  cefrLevel: string
  status: NodeStatus
  dayNumber: number
  tags: string[]
}

export function mapSkillNode(r: RawSkillNode): SkillNode {
  let tags: string[] = []
  if (Array.isArray(r.tags)) tags = r.tags
  else if (typeof r.tags === 'string') {
    try {
      const parsed = JSON.parse(r.tags)
      if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string')
    } catch {
      // leave empty
    }
  }
  return {
    id: r.id,
    title: r.title_vi || r.title_de || `Ngày ${r.day_number ?? ''}`.trim(),
    cefrLevel: r.cefr_level ?? '',
    status: (r.user_status ?? r.status ?? 'LOCKED') as NodeStatus,
    dayNumber: r.day_number ?? 0,
    tags,
  }
}

export const skillTreeApi = {
  getMySkillTree: () =>
    api.get<RawSkillNode[]>('/skill-tree/me').then((r) => r.data.map(mapSkillNode)),

  getNodeSession: (nodeId: number | string) =>
    api.get<NodeSession>(`/skill-tree/node/${nodeId}/session`).then((r) => r.data),

  // The backend re-grades the raw item answers against the content_json answer key
  // (server-authoritative). score_percent is kept only as a legacy fallback for nodes with
  // no deterministic items (SPEAKING/WRITING are AI-graded). Always send item_answers so the
  // stored score and node-completion can't be spoofed by a tampered client.
  submitNode: (
    nodeId: number | string,
    scorePercent: number,
    itemAnswers?: Record<string, { choice?: number; text?: string }>,
  ) =>
    api
      .post<NodeSubmitResult>(`/skill-tree/${nodeId}/submit`, {
        score_percent: scorePercent,
        item_answers: itemAnswers ?? {},
      })
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
