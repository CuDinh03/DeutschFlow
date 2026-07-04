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

// ── 4-skill authored exercises (content_json.skill_exercises) ────────────────
// One heterogeneous item shape covering all 16 exercise types across the 4 skills
// (Hören/Sprechen/Lesen/Schreiben). Only the fields the runner reads are typed; the
// server (PracticeExerciseGrader) is authoritative on grading.
export interface SkillExerciseItem {
  type: string
  instruction_vi?: string
  explanation_vi?: string
  audio_transcript?: string // Hören: TTS reads this aloud
  question_vi?: string
  options?: string[]
  correct_index?: number
  sentence_with_blank?: string
  sentence_vi?: string
  hint_vi?: string
  grammar_rule_vi?: string
  correct_answer?: string | boolean
  accept_also?: string[]
  statement_de?: string // READ_TRUE_FALSE
  words?: string[] // REORDER_WORDS
  correct_order?: string[]
  translation_vi?: string
  sentence_de?: string // SPEAKING_REPEAT
  question_de?: string // SPEAKING_RESPONSE
  expected_answer?: string
  focus_sounds?: string[]
  grading_keywords?: string[]
}
export interface LesenBlock {
  reading_passage?: { text_de?: string; text_type?: string; text_vi_hint?: string }
  exercises?: SkillExerciseItem[]
}
export interface SkillExercises {
  HOEREN?: SkillExerciseItem[]
  SPRECHEN?: SkillExerciseItem[]
  LESEN?: LesenBlock
  SCHREIBEN?: SkillExerciseItem[]
}

export interface NodeContent {
  title?: { de?: string; vi?: string }
  overview?: { de?: string; vi?: string }
  theory_cards?: TheoryCard[]
  vocabulary?: NodeVocabItem[]
  phrases?: NodePhrase[]
  exercises?: { theory_gate?: Exercise[]; practice?: Exercise[] }
  skill_exercises?: SkillExercises
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
  sort_order?: number | null
  user_status?: string | null
  status?: string | null
  // Curriculum/topic context. /skill-tree/me returns these as raw snake_case
  // (queryForList); the JSON-text columns arrive as `to_jsonb(...)::text` strings.
  phase?: string | null
  industry?: string | null
  module_title_vi?: string | null
  session_type?: string | null
  emoji?: string | null
  dependencies_met?: boolean | null
  tags?: string | string[] | null
  core_topics?: string | string[] | null
  grammar_points?: string | string[] | null
  prerequisites_json?: string | unknown[] | null
}

export interface SkillNode {
  id: number
  title: string
  cefrLevel: string
  status: NodeStatus
  dayNumber: number
  sortOrder: number
  tags: string[]
  // Pha 3: full topic/curriculum context (previously dropped at the TS boundary).
  phase: string | null
  industry: string | null
  moduleTitle: string | null
  sessionType: string | null
  emoji: string | null
  coreTopics: string[]
  grammarPoints: string[]
  prerequisites: string[] // node_code list, from prerequisites_json
  dependenciesMet: boolean
}

// Backend lifecycle is LOCKED → UNLOCKED → IN_PROGRESS → COMPLETED, but the app
// uses 'AVAILABLE' for the unlocked-not-started state. Without this normalization a
// real 'UNLOCKED' row matches none of the app's motifs and renders as locked-grey,
// non-tappable — so unlocked lessons (incl. the recommended next one) look locked.
function normalizeStatus(raw: string | null | undefined): NodeStatus {
  const s = (raw ?? '').toUpperCase()
  if (s === 'UNLOCKED' || s === 'AVAILABLE') return 'AVAILABLE'
  if (s === 'IN_PROGRESS' || s === 'COMPLETED' || s === 'LOCKED') return s
  return 'LOCKED'
}

// Parse a wire value that is either an array, a JSON-text array (the backend's
// `to_jsonb(...)::text`), or null, into a clean string[]. Strings pass through;
// objects contribute their node_code/code/id (prerequisites_json may be a list of
// either bare codes or `{node_code}` objects — spec H3). Never throws.
function asStringArray(raw: string | unknown[] | null | undefined): string[] {
  let val: unknown = raw
  if (typeof raw === 'string') {
    try {
      val = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(val)) return []
  const out: string[] = []
  for (const item of val) {
    if (typeof item === 'string') {
      out.push(item)
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const code = o.node_code ?? o.code ?? o.id
      if (typeof code === 'string') out.push(code)
    }
  }
  return out
}

export function mapSkillNode(r: RawSkillNode): SkillNode {
  return {
    id: r.id,
    title: r.title_vi || r.title_de || `Ngày ${r.day_number ?? ''}`.trim(),
    cefrLevel: r.cefr_level ?? '',
    status: normalizeStatus(r.user_status ?? r.status),
    dayNumber: r.day_number ?? 0,
    sortOrder: r.sort_order ?? 0,
    tags: asStringArray(r.tags),
    phase: r.phase ?? null,
    industry: r.industry ?? null,
    moduleTitle: r.module_title_vi ?? null,
    sessionType: r.session_type ?? null,
    emoji: r.emoji ?? null,
    coreTopics: asStringArray(r.core_topics),
    grammarPoints: asStringArray(r.grammar_points),
    prerequisites: asStringArray(r.prerequisites_json),
    dependenciesMet: r.dependencies_met === true,
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

  // Mark a theory-only node (no gradeable exercises, e.g. the alphabet lesson) as learned.
  // The backend rejects this for nodes that DO have scored exercises — those must go through
  // submitNode so their score is graded server-side.
  markNodeComplete: (nodeId: number | string) =>
    api.post<NodeSubmitResult>(`/skill-tree/${nodeId}/complete`).then((r) => r.data),

  // Submit the authored 4-skill exercise sets (content_json.skill_exercises). The backend
  // re-grades every item server-side (PracticeExerciseGrader) and completes the node when the
  // aggregate reaches its mastery_threshold. `skillAnswers` is keyed by skill → item index →
  // { answer } (answer = option index for choice items, or the typed/joined string, or "spoken").
  submitSkillExercises: (
    nodeId: number | string,
    skillAnswers: Record<string, Record<string, { answer: number | string }>>,
  ) =>
    api
      .post<NodeSubmitResult & { perSkill?: Record<string, { scored: number; correct: number }> }>(
        `/skill-tree/${nodeId}/skill-exercises/submit`,
        { skill_answers: skillAnswers },
      )
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
