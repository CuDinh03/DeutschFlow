// Pacing helpers for the per-class course screens (Phase 1a). Pure functions over the
// lesson list + a caller-supplied "today" (ISO yyyy-MM-dd) so they stay unit-testable.
//
// plannedDate and today are ISO date strings (yyyy-MM-dd); lexicographic comparison on
// that format is chronological, so no Date parsing is needed.

export interface PacedLesson {
  completed: boolean
  plannedDate: string | null
}

export type PacingStatus = 'none' | 'behind' | 'onTrack' | 'ahead'

export interface PacingSummary {
  status: PacingStatus
  /** Lessons whose planned date has passed but that are not yet completed. */
  overdueCount: number
  /** Lessons with a planned date on or before today (i.e. due by now). */
  dueByNow: number
  /** How many lessons carry a planned date at all (0 → status is 'none'). */
  plannedCount: number
}

/** A lesson is overdue when it has a past planned date and is still not completed. */
export function isLessonOverdue(lesson: PacedLesson, todayIso: string): boolean {
  return lesson.plannedDate != null && lesson.plannedDate < todayIso && !lesson.completed
}

/** A completed lesson planned for a future date was taught ahead of schedule. */
function isTaughtAhead(lesson: PacedLesson, todayIso: string): boolean {
  return lesson.completed && lesson.plannedDate != null && lesson.plannedDate > todayIso
}

export function computePacing(lessons: PacedLesson[], todayIso: string): PacingSummary {
  const planned = lessons.filter((l) => l.plannedDate != null)
  if (planned.length === 0) {
    return { status: 'none', overdueCount: 0, dueByNow: 0, plannedCount: 0 }
  }

  const overdueCount = planned.filter((l) => isLessonOverdue(l, todayIso)).length
  const dueByNow = planned.filter((l) => (l.plannedDate as string) <= todayIso).length

  let status: PacingStatus
  if (overdueCount > 0) {
    status = 'behind'
  } else if (lessons.some((l) => isTaughtAhead(l, todayIso))) {
    status = 'ahead'
  } else {
    status = 'onTrack'
  }

  return { status, overdueCount, dueByNow, plannedCount: planned.length }
}

/** Local calendar date as an ISO yyyy-MM-dd string (timezone-safe, no UTC shift). */
export function todayIsoLocal(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse a yyyy-MM-dd date-only string as a LOCAL calendar date. `new Date('yyyy-MM-dd')`
 * parses at UTC midnight, so `format()` would show the previous day in negative-UTC-offset
 * timezones; this builds the date in local time to avoid that day-boundary shift.
 */
export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
