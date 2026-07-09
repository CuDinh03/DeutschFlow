// Pure helpers for the 4-skill authored exercise runner (content_json.skill_exercises).
// Kept dependency-free + unit-tested; the runner screen owns rendering, these own the data
// shape, the answer-payload assembly, and the instant local-feedback grading (which mirrors the
// server's PracticeExerciseGrader — the server stays authoritative on the stored score).

import type { SkillExerciseItem, LesenBlock, SkillExercises } from './skillTreeApi'

export const SKILL_ORDER = ['HOEREN', 'SPRECHEN', 'LESEN', 'SCHREIBEN'] as const
export type SkillKey = (typeof SKILL_ORDER)[number]

export const SKILL_LABEL: Record<SkillKey, string> = {
  HOEREN: 'Nghe',
  SPRECHEN: 'Nói',
  LESEN: 'Đọc',
  SCHREIBEN: 'Viết',
}
export const SKILL_EMOJI: Record<SkillKey, string> = {
  HOEREN: '🎧',
  SPRECHEN: '🗣️',
  LESEN: '📖',
  SCHREIBEN: '✏️',
}

/** Items for a skill. Lesen stores {reading_passage, exercises}; the others are plain arrays. */
export function itemsOf(se: SkillExercises | undefined, skill: SkillKey): SkillExerciseItem[] {
  const node = se?.[skill]
  if (!node) return []
  return Array.isArray(node) ? node : (node.exercises ?? [])
}

export function passageOf(se: SkillExercises | undefined): LesenBlock['reading_passage'] | undefined {
  const l = se?.LESEN
  return l && !Array.isArray(l) ? l.reading_passage : undefined
}

export function hasAnySkillExercise(se: SkillExercises | undefined): boolean {
  return SKILL_ORDER.some((s) => itemsOf(se, s).length > 0)
}

/** Skills that actually have items, in fixed order — the tabs to render. */
export function activeSkills(se: SkillExercises | undefined): SkillKey[] {
  return SKILL_ORDER.filter((s) => itemsOf(se, s).length > 0)
}

// ── item-type predicates (drive which input widget renders) ─────────────────
export const isChoiceType = (t: string): boolean => t === 'LISTEN_AND_CHOOSE' || t === 'READ_AND_CHOOSE'
export const isTrueFalse = (t: string): boolean => t === 'READ_TRUE_FALSE'
export const isReorder = (t: string): boolean => t === 'REORDER_WORDS'
export const isSpeaking = (t: string): boolean => t.startsWith('SPEAKING') || t === 'FREE_WRITE'
export const isTextType = (t: string): boolean =>
  ['LISTEN_AND_FILL', 'DICTATION', 'READ_AND_FILL', 'TRANSLATE_VI_DE', 'FILL_GRAMMAR'].includes(t)

/**
 * The prompt the card HEADER hides. The runner header shows `instruction_vi ?? question_vi ??
 * statement_de`, so when an item has BOTH an instruction and a real prompt — the question
 * (READ_AND_CHOOSE / LISTEN_AND_CHOOSE → question_vi) or the statement to judge (READ_TRUE_FALSE
 * → statement_de) — only the instruction shows and the actual question is dropped (card looks
 * "answer-only"). This returns the dropped prompt so the runner can render it explicitly.
 * Returns undefined for speaking items (SpeakingInput renders its own model/gloss) and when there
 * is no instruction (the header already shows the question).
 */
export function hiddenPromptOf(item: SkillExerciseItem): string | undefined {
  if (isSpeaking(item.type)) return undefined
  if (!item.instruction_vi) return undefined
  return item.question_vi ?? item.statement_de ?? undefined
}

/** The answer a runner stores per item: option index (choice), a typed/joined string, or undefined. */
export type SkillAnswer = number | string | undefined

/** Key an item's answer by `${skill}:${index}` so one flat map holds all four skills. */
export const answerKey = (skill: SkillKey, index: number): string => `${skill}:${index}`

const norm = (s: string): string => (s ?? '').toLowerCase().trim()

/**
 * Instant local correctness for UI feedback — mirrors the backend PracticeExerciseGrader precedence:
 * correct_index (option) → correct_answer (+accept_also, case/space-insensitive) → the "spoken"
 * sentinel (AI-graded speaking / free-write). The server re-grades on submit and wins.
 */
export function localIsCorrect(item: SkillExerciseItem, submitted: SkillAnswer): boolean {
  if (typeof item.correct_index === 'number' && typeof submitted === 'number') {
    return item.correct_index === submitted
  }
  if (item.correct_answer != null && typeof submitted === 'string') {
    const n = norm(submitted)
    if (norm(String(item.correct_answer)) === n) return true
    return (item.accept_also ?? []).some((a) => norm(String(a)) === n)
  }
  return submitted === 'spoken'
}

/**
 * Assemble the POST body: skill → { "0": {answer}, "1": {answer}, … }. Untouched speaking/
 * free-write items default to the "spoken" sentinel (attempted); untouched gradeable items send an
 * empty string (graded wrong). Only skills that have items are included.
 */
export function buildSkillAnswers(
  se: SkillExercises | undefined,
  answers: Record<string, SkillAnswer>,
): Record<string, Record<string, { answer: number | string }>> {
  const out: Record<string, Record<string, { answer: number | string }>> = {}
  for (const skill of SKILL_ORDER) {
    const items = itemsOf(se, skill)
    if (!items.length) continue
    const m: Record<string, { answer: number | string }> = {}
    items.forEach((it, i) => {
      let a = answers[answerKey(skill, i)]
      if (a === undefined) a = isSpeaking(it.type) ? 'spoken' : ''
      m[String(i)] = { answer: a as number | string }
    })
    out[skill] = m
  }
  return out
}
