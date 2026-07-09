import { describe, it, expect } from 'vitest'
import { computePacing, isLessonOverdue, todayIsoLocal, parseIsoDateLocal, type PacedLesson } from './lessonPacing'

const L = (completed: boolean, plannedDate: string | null): PacedLesson => ({ completed, plannedDate })
const TODAY = '2026-07-08'

describe('computePacing', () => {
  it("returns 'none' when no lesson carries a planned date", () => {
    const p = computePacing([L(false, null), L(true, null)], TODAY)
    expect(p.status).toBe('none')
    expect(p.plannedCount).toBe(0)
  })

  it("returns 'behind' and counts overdue when a past-planned lesson is not completed", () => {
    const p = computePacing([L(false, '2026-07-01'), L(true, '2026-07-05')], TODAY)
    expect(p.status).toBe('behind')
    expect(p.overdueCount).toBe(1)
    expect(p.dueByNow).toBe(2)
  })

  it("returns 'onTrack' when all past-due lessons are completed and none taught ahead", () => {
    const p = computePacing([L(true, '2026-07-01'), L(false, '2026-07-20')], TODAY)
    expect(p.status).toBe('onTrack')
    expect(p.overdueCount).toBe(0)
  })

  it("returns 'ahead' when a future-planned lesson is already completed", () => {
    const p = computePacing([L(true, '2026-07-01'), L(true, '2026-07-20')], TODAY)
    expect(p.status).toBe('ahead')
  })

  it("prioritizes 'behind' over 'ahead' when both overdue and taught-ahead exist", () => {
    const p = computePacing([L(false, '2026-07-01'), L(true, '2026-07-20')], TODAY)
    expect(p.status).toBe('behind')
  })

  it('treats a lesson planned exactly today as due but not overdue', () => {
    const p = computePacing([L(false, TODAY)], TODAY)
    expect(p.dueByNow).toBe(1)
    expect(p.overdueCount).toBe(0)
    expect(p.status).toBe('onTrack')
  })
})

describe('isLessonOverdue', () => {
  it('is true only for a past-planned, not-yet-completed lesson', () => {
    expect(isLessonOverdue(L(false, '2026-07-01'), TODAY)).toBe(true)
    expect(isLessonOverdue(L(true, '2026-07-01'), TODAY)).toBe(false) // completed
    expect(isLessonOverdue(L(false, '2026-07-20'), TODAY)).toBe(false) // future
    expect(isLessonOverdue(L(false, TODAY), TODAY)).toBe(false) // today is not past
    expect(isLessonOverdue(L(false, null), TODAY)).toBe(false) // no plan
  })
})

describe('todayIsoLocal', () => {
  it('formats a local date without any UTC shift', () => {
    expect(todayIsoLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayIsoLocal(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('parseIsoDateLocal', () => {
  it('parses yyyy-MM-dd as a local calendar date (no UTC day-boundary shift)', () => {
    const d = parseIsoDateLocal('2026-07-20')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // July is month index 6
    expect(d.getDate()).toBe(20)
  })

  it('round-trips with todayIsoLocal', () => {
    expect(todayIsoLocal(parseIsoDateLocal('2026-01-05'))).toBe('2026-01-05')
  })
})
