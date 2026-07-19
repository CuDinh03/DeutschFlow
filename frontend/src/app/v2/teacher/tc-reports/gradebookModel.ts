import type {
  GradebookAssignment,
  GradebookCell,
  GradebookStudent,
} from '@/lib/teacherGradebookApi'

/**
 * Pure, display-agnostic gradebook logic shared by the matrix view, the list view and the
 * printable sheet. Keeping it here (no JSX, no React) means the windowing / filtering /
 * per-assignment + per-student stats are unit-tested in isolation, and the three views stay
 * consistent because they all classify a cell the same way.
 *
 * The status vocabulary mirrors the backend AssignmentStatus:
 *   FINAL_GRADES     = {GRADED, EVALUATED}          → a teacher-confirmed grade
 *   AWAITING_TEACHER = {SUBMITTED, AI_GRADED, GRADING_FAILED} → handed in, still needs the teacher
 *   PENDING          = assigned but never handed in
 * Only FINAL grades may feed an average — an AI_GRADED row carries a score but it is a proposal
 * nobody has confirmed, so counting it would present the AI's number as the student's grade.
 */

/** Matrix mode shows this many assignment columns per page; the printable sheet chunks by the same size. */
export const MATRIX_WINDOW_SIZE = 8

/** Confirmed grades (mirror backend AssignmentStatus.FINAL_GRADES). Only these feed averages. */
export const FINAL_STATUSES: ReadonlySet<string> = new Set(['GRADED', 'EVALUATED'])
/** Handed in but still needs the teacher (mirror backend AssignmentStatus.AWAITING_TEACHER). */
export const AWAITING_STATUSES: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'AI_GRADED',
  'GRADING_FAILED',
])

export type SkillKey = 'horen' | 'lesen' | 'schreiben' | 'sprechen'
export const SKILL_KEYS: readonly SkillKey[] = ['horen', 'lesen', 'schreiben', 'sprechen']

/** Normalise a raw backend skill tag ("HOREN", "Lesen", …) to a known key, or null for GENERAL/unknown. */
export function resolveSkillKey(skill: string | null | undefined): SkillKey | null {
  if (!skill) return null
  switch (skill.trim().toLowerCase()) {
    case 'horen':
      return 'horen'
    case 'lesen':
      return 'lesen'
    case 'schreiben':
      return 'schreiben'
    case 'sprechen':
      return 'sprechen'
    default:
      return null
  }
}

/** Value of the skill filter: a specific skill, everything without a skill tag, or no filter. */
export type SkillFilter = SkillKey | 'other' | 'all'

/**
 * Display-agnostic classification of one cell. STATUS is read before SCORE (deliberate): an
 * AI_GRADED row carries a score but must never render as a plain grade, and a GRADING_FAILED
 * row must not fall through to "not submitted".
 */
export type CellKind =
  | 'awaitingConfirm' // AI_GRADED — AI proposal, not a confirmed grade
  | 'regradeNeeded' // GRADING_FAILED
  | 'submitted' // SUBMITTED — handed in, awaiting first grade
  | 'pendingGrade' // GRADED/EVALUATED but score still null
  | 'score' // GRADED/EVALUATED with a numeric score
  | 'notSubmitted' // PENDING / unknown status
  | 'empty' // no cell — the assignment was never fanned out to this student

export interface CellInfo {
  kind: CellKind
  score: number | null
}

export function classifyCell(cell: GradebookCell | undefined | null): CellInfo {
  if (cell == null) return { kind: 'empty', score: null }
  switch (cell.status) {
    case 'AI_GRADED':
      return { kind: 'awaitingConfirm', score: null }
    case 'GRADING_FAILED':
      return { kind: 'regradeNeeded', score: null }
    case 'SUBMITTED':
      return { kind: 'submitted', score: null }
    case 'GRADED':
    case 'EVALUATED':
      return cell.score != null
        ? { kind: 'score', score: cell.score }
        : { kind: 'pendingGrade', score: null }
    default:
      return { kind: 'notSubmitted', score: null }
  }
}

/** Did the student hand this work in? Anything but PENDING/empty (mirror backend isSubmitted). */
export function isSubmitted(cell: GradebookCell | undefined | null): boolean {
  if (cell == null) return false
  return AWAITING_STATUSES.has(cell.status) || FINAL_STATUSES.has(cell.status)
}

/** Does this cell still need a teacher grading action (grade / confirm / re-grade)? */
export function isAwaitingGrade(cell: GradebookCell | undefined | null): boolean {
  return cell != null && AWAITING_STATUSES.has(cell.status)
}

/** The confirmed, clamped score of a cell, or null when the cell is not a final grade. */
export function finalScore(cell: GradebookCell | undefined | null): number | null {
  if (cell == null || cell.score == null) return null
  return FINAL_STATUSES.has(cell.status) ? clampPercent(cell.score) : null
}

export function clampPercent(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Column stats for the by-assignment list row. avgScore counts CONFIRMED grades only. */
export interface AssignmentStats {
  assigned: number
  submitted: number
  awaiting: number
  avgScore: number | null
}

export function assignmentStats(
  students: readonly GradebookStudent[],
  assignmentId: number,
): AssignmentStats {
  const key = String(assignmentId)
  let assigned = 0
  let submitted = 0
  let awaiting = 0
  const scores: number[] = []
  for (const student of students) {
    const cell = student.cells[key]
    if (cell == null) continue
    assigned += 1
    if (isSubmitted(cell)) submitted += 1
    if (isAwaitingGrade(cell)) awaiting += 1
    const score = finalScore(cell)
    if (score != null) scores.push(score)
  }
  const avgScore =
    scores.length > 0 ? round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null
  return { assigned, submitted, awaiting, avgScore }
}

/** Row stats for the by-student list row. */
export interface StudentStats {
  assigned: number
  submitted: number
  rate: number | null
}

export function studentStats(
  student: GradebookStudent,
  assignments: readonly GradebookAssignment[],
): StudentStats {
  let assigned = 0
  let submitted = 0
  for (const assignment of assignments) {
    const cell = student.cells[String(assignment.id)]
    if (cell == null) continue
    assigned += 1
    if (isSubmitted(cell)) submitted += 1
  }
  const rate = assigned > 0 ? Math.round((submitted / assigned) * 100) : null
  return { assigned, submitted, rate }
}

/** Apply the skill + name filters to the assignment list, preserving order. */
export function filterAssignments(
  assignments: readonly GradebookAssignment[],
  filter: { skill: SkillFilter; query: string },
): GradebookAssignment[] {
  const q = filter.query.trim().toLowerCase()
  return assignments.filter((assignment) => {
    if (filter.skill !== 'all') {
      const key = resolveSkillKey(assignment.skill)
      if (filter.skill === 'other') {
        if (key != null) return false
      } else if (key !== filter.skill) {
        return false
      }
    }
    if (q.length > 0 && !assignment.topic.toLowerCase().includes(q)) return false
    return true
  })
}

/** Split a list into fixed-size groups, preserving order (used by the matrix window + printable chunks). */
export function chunk<T>(items: readonly T[], size: number = MATRIX_WINDOW_SIZE): T[][] {
  if (size <= 0) return [items.slice()]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A page-sized window over the assignment columns. */
export interface ColumnWindow<T> {
  items: T[]
  page: number
  pageCount: number
  /** 1-based index of the first / last column shown (0 when empty). */
  from: number
  to: number
  total: number
}

export function windowAt<T>(
  items: readonly T[],
  page: number,
  size: number = MATRIX_WINDOW_SIZE,
): ColumnWindow<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const clamped = Math.min(Math.max(0, Math.trunc(page)), pageCount - 1)
  // Windows are anchored at the NEWEST end: the last page (index pageCount-1, the default) always
  // shows the final `size` columns, so "the 8 newest" is always a full 8 when that many exist and
  // only the OLDEST page carries the short remainder. With 32 columns the pages read 1–8 / 9–16 /
  // 17–24 / 25–32, and the gradebook opens on 25–32.
  const distanceFromNewest = pageCount - 1 - clamped
  const end = Math.max(0, total - distanceFromNewest * size)
  const start = Math.max(0, end - size)
  const slice = items.slice(start, end)
  return {
    items: slice,
    page: clamped,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: end,
    total,
  }
}

/** Index of the last (newest) window — the default the matrix opens on. */
export function lastPageIndex(total: number, size: number = MATRIX_WINDOW_SIZE): number {
  return Math.max(0, Math.ceil(total / size) - 1)
}
