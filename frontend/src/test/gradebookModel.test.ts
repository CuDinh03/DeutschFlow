import { describe, it, expect } from 'vitest'
import type {
  GradebookAssignment,
  GradebookCell,
  GradebookStudent,
} from '@/lib/teacherGradebookApi'
import {
  assignmentStats,
  chunk,
  classifyCell,
  filterAssignments,
  finalScore,
  isAwaitingGrade,
  isSubmitted,
  lastPageIndex,
  MATRIX_WINDOW_SIZE,
  resolveSkillKey,
  studentStats,
  windowAt,
} from '@/app/v2/teacher/tc-reports/gradebookModel'

function cell(status: string, score: number | null = null): GradebookCell {
  return { status, score, submittedAt: null }
}

function assignment(id: number, skill: string | null, topic = `Bài ${id}`): GradebookAssignment {
  return { id, topic, assignmentType: 'GENERAL', skill, dueDate: null }
}

function student(id: number, cells: Record<string, GradebookCell>, avg: number | null = null): GradebookStudent {
  return { studentId: id, name: `HV ${id}`, email: `hv${id}@x.vn`, avgScore: avg, cells }
}

describe('classifyCell', () => {
  it('is status-first: AI_GRADED is a proposal, never a score', () => {
    expect(classifyCell(cell('AI_GRADED', 88))).toEqual({ kind: 'awaitingConfirm', score: null })
  })
  it('keeps GRADING_FAILED distinct from not-submitted', () => {
    expect(classifyCell(cell('GRADING_FAILED'))).toEqual({ kind: 'regradeNeeded', score: null })
  })
  it('SUBMITTED is a submitted/awaiting badge', () => {
    expect(classifyCell(cell('SUBMITTED'))).toEqual({ kind: 'submitted', score: null })
  })
  it('a confirmed grade with a score is a score', () => {
    expect(classifyCell(cell('GRADED', 75))).toEqual({ kind: 'score', score: 75 })
    expect(classifyCell(cell('EVALUATED', 90))).toEqual({ kind: 'score', score: 90 })
  })
  it('a final status with no score is still pending', () => {
    expect(classifyCell(cell('GRADED', null))).toEqual({ kind: 'pendingGrade', score: null })
  })
  it('PENDING and unknown statuses are not-submitted', () => {
    expect(classifyCell(cell('PENDING'))).toEqual({ kind: 'notSubmitted', score: null })
    expect(classifyCell(cell('WHATEVER'))).toEqual({ kind: 'notSubmitted', score: null })
  })
  it('a missing cell is empty', () => {
    expect(classifyCell(undefined)).toEqual({ kind: 'empty', score: null })
  })
})

describe('cell predicates', () => {
  it('isSubmitted covers awaiting + final, excludes PENDING/empty', () => {
    expect(isSubmitted(cell('SUBMITTED'))).toBe(true)
    expect(isSubmitted(cell('AI_GRADED'))).toBe(true)
    expect(isSubmitted(cell('EVALUATED', 80))).toBe(true)
    expect(isSubmitted(cell('PENDING'))).toBe(false)
    expect(isSubmitted(undefined)).toBe(false)
  })
  it('isAwaitingGrade is only the three teacher-action statuses', () => {
    expect(isAwaitingGrade(cell('SUBMITTED'))).toBe(true)
    expect(isAwaitingGrade(cell('AI_GRADED'))).toBe(true)
    expect(isAwaitingGrade(cell('GRADING_FAILED'))).toBe(true)
    expect(isAwaitingGrade(cell('GRADED', 90))).toBe(false)
  })
  it('finalScore counts only confirmed grades and clamps to [0,100]', () => {
    expect(finalScore(cell('GRADED', 90))).toBe(90)
    expect(finalScore(cell('EVALUATED', 150))).toBe(100)
    expect(finalScore(cell('AI_GRADED', 90))).toBeNull() // proposal must not count
    expect(finalScore(cell('SUBMITTED'))).toBeNull()
  })
})

describe('assignmentStats', () => {
  it('counts assigned/submitted/awaiting and averages CONFIRMED grades only', () => {
    const students: GradebookStudent[] = [
      student(1, { '10': cell('EVALUATED', 80) }),
      student(2, { '10': cell('AI_GRADED', 100) }), // proposal — excluded from avg but is submitted+awaiting
      student(3, { '10': cell('SUBMITTED') }),
      student(4, { '10': cell('PENDING') }), // assigned, not submitted
      student(5, {}), // never assigned this one
    ]
    const stats = assignmentStats(students, 10)
    expect(stats.assigned).toBe(4)
    expect(stats.submitted).toBe(3) // EVALUATED + AI_GRADED + SUBMITTED
    expect(stats.awaiting).toBe(2) // AI_GRADED + SUBMITTED
    expect(stats.avgScore).toBe(80) // only the confirmed 80
  })
  it('avgScore is null when no confirmed grades exist', () => {
    const students = [student(1, { '10': cell('SUBMITTED') })]
    expect(assignmentStats(students, 10).avgScore).toBeNull()
  })
})

describe('studentStats', () => {
  it('computes submission rate over assigned assignments', () => {
    const assignments = [assignment(1, 'HOREN'), assignment(2, 'LESEN'), assignment(3, 'SCHREIBEN')]
    const s = student(1, {
      '1': cell('EVALUATED', 80),
      '2': cell('PENDING'),
      // assignment 3 never fanned out to this student
    })
    const stats = studentStats(s, assignments)
    expect(stats.assigned).toBe(2)
    expect(stats.submitted).toBe(1)
    expect(stats.rate).toBe(50)
  })
})

describe('resolveSkillKey', () => {
  it('normalises known skills and rejects GENERAL/unknown/null', () => {
    expect(resolveSkillKey('HOREN')).toBe('horen')
    expect(resolveSkillKey(' Lesen ')).toBe('lesen')
    expect(resolveSkillKey('GENERAL')).toBeNull()
    expect(resolveSkillKey(null)).toBeNull()
  })
})

describe('filterAssignments', () => {
  const list = [
    assignment(1, 'HOREN', 'Nghe hiểu 1'),
    assignment(2, 'LESEN', 'Đọc hiểu'),
    assignment(3, 'GENERAL', 'Ôn tập chung'),
    assignment(4, null, 'Nghe hiểu 2'),
  ]
  it('filters by a specific skill', () => {
    expect(filterAssignments(list, { skill: 'horen', query: '' }).map((a) => a.id)).toEqual([1])
  })
  it("'other' keeps assignments without a recognised skill", () => {
    expect(filterAssignments(list, { skill: 'other', query: '' }).map((a) => a.id)).toEqual([3, 4])
  })
  it("'all' keeps everything", () => {
    expect(filterAssignments(list, { skill: 'all', query: '' })).toHaveLength(4)
  })
  it('filters by case-insensitive topic substring', () => {
    expect(filterAssignments(list, { skill: 'all', query: 'nghe' }).map((a) => a.id)).toEqual([1, 4])
  })
  it('combines skill and query', () => {
    expect(filterAssignments(list, { skill: 'horen', query: 'nghe hiểu 2' }).map((a) => a.id)).toEqual([])
  })
})

describe('chunk', () => {
  it('splits into fixed-size groups preserving order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('defaults to the matrix window size', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const groups = chunk(items)
    expect(groups[0]).toHaveLength(MATRIX_WINDOW_SIZE)
    expect(groups).toHaveLength(Math.ceil(20 / MATRIX_WINDOW_SIZE))
  })
})

describe('windowAt (newest-anchored)', () => {
  const items = Array.from({ length: 32 }, (_, i) => i + 1) // 1..32

  it('default (last page) shows the 8 newest as a full window', () => {
    const w = windowAt(items, lastPageIndex(items.length))
    expect(w.items).toEqual([25, 26, 27, 28, 29, 30, 31, 32])
    expect(w.from).toBe(25)
    expect(w.to).toBe(32)
    expect(w.page).toBe(3)
    expect(w.pageCount).toBe(4)
  })
  it('pages land on clean 8-column boundaries', () => {
    expect(windowAt(items, 2).from).toBe(17)
    expect(windowAt(items, 2).to).toBe(24)
    expect(windowAt(items, 0).items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it('only the OLDEST page carries a short remainder', () => {
    const ten = Array.from({ length: 10 }, (_, i) => i + 1)
    const newest = windowAt(ten, lastPageIndex(10))
    expect(newest.items).toEqual([3, 4, 5, 6, 7, 8, 9, 10]) // full 8
    const oldest = windowAt(ten, 0)
    expect(oldest.items).toEqual([1, 2]) // remainder
    expect(oldest.from).toBe(1)
    expect(oldest.to).toBe(2)
  })
  it('clamps out-of-range pages and handles empty input', () => {
    expect(windowAt(items, 99).page).toBe(3)
    expect(windowAt(items, -5).page).toBe(0)
    const empty = windowAt([], 0)
    expect(empty.items).toEqual([])
    expect(empty.from).toBe(0)
    expect(empty.to).toBe(0)
    expect(empty.pageCount).toBe(1)
  })
  it('a single short page reports from/to correctly', () => {
    const w = windowAt([1, 2, 3], 0)
    expect(w.items).toEqual([1, 2, 3])
    expect(w.from).toBe(1)
    expect(w.to).toBe(3)
    expect(w.pageCount).toBe(1)
  })
})
