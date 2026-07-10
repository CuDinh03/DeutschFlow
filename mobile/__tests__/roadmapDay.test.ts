import { nextStudyDay } from '@/lib/roadmapDay'
import type { SkillNode } from '@/lib/skillTreeApi'

// nextStudyDay only reads status + dayNumber; build minimal rows for clarity.
type Row = Pick<SkillNode, 'status' | 'dayNumber'>
const n = (status: SkillNode['status'], dayNumber: number): Row => ({ status, dayNumber })

describe('nextStudyDay — Home roadmap tile "Ngày N"', () => {
  test('returns the first IN_PROGRESS day (the lesson being studied)', () => {
    // Arrange: day 4 in progress, day 5 unlocked next.
    const nodes = [n('COMPLETED', 1), n('COMPLETED', 2), n('COMPLETED', 3), n('IN_PROGRESS', 4), n('AVAILABLE', 5)]
    // Act & Assert
    expect(nextStudyDay(nodes)).toBe(4)
  })

  test('after completing day 4 (no IN_PROGRESS) falls to the next AVAILABLE day — NOT 1', () => {
    // This is the regression: the old code used inProgress[0]?.dayNumber ?? 1 and snapped to 1.
    const nodes = [n('COMPLETED', 1), n('COMPLETED', 2), n('COMPLETED', 3), n('COMPLETED', 4), n('AVAILABLE', 5)]
    expect(nextStudyDay(nodes)).toBe(5)
  })

  test('all completed, nothing unlocked yet → max(completed)+1', () => {
    const nodes = [n('COMPLETED', 1), n('COMPLETED', 2), n('COMPLETED', 3), n('COMPLETED', 4), n('LOCKED', 5)]
    expect(nextStudyDay(nodes)).toBe(5)
  })

  test('brand-new account (all locked, none started) → 1', () => {
    const nodes = [n('AVAILABLE', 1), n('LOCKED', 2)]
    expect(nextStudyDay(nodes)).toBe(1)
  })

  test('empty tree → 1', () => {
    expect(nextStudyDay([])).toBe(1)
  })

  test('ignores dayNumber 0 (backend row with no day set) and uses the next real match', () => {
    // An IN_PROGRESS node with day 0 must not surface as "Ngày 0"; fall through to AVAILABLE 3.
    const nodes = [n('IN_PROGRESS', 0), n('AVAILABLE', 3)]
    expect(nextStudyDay(nodes)).toBe(3)
  })

  test('AVAILABLE is preferred over completed+1 when both point at the same day', () => {
    const nodes = [n('COMPLETED', 4), n('AVAILABLE', 5)]
    expect(nextStudyDay(nodes)).toBe(5)
  })
})
