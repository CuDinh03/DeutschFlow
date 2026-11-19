import type { ExamAttempt } from '@/lib/examApi'
import type { ExamPlan } from '@/lib/examPlanApi'
import { scoreBars } from '@/lib/examScoreChart'
import { planLine, planSummary, skillStats } from '@/lib/diagnosticSummary'

const attempt = (id: number, score: number | null, finished: string, status = 'COMPLETED', examId = 7): ExamAttempt => ({
  id,
  exam_id: examId,
  exam_title: 'Đề 1',
  started_at: finished,
  finished_at: finished,
  total_score: score,
  passed: null,
  status,
})

describe('scoreBars — biểu đồ điểm màn Đề', () => {
  test('chỉ lượt nộp đủ của đề này, cũ → mới, tối đa 6, cột cuối là lượt mới nhất', () => {
    const list = [
      attempt(1, 117, '2026-10-12T10:00:00Z'),
      attempt(2, 130, '2026-10-19T10:00:00Z'),
      attempt(3, 90, '2026-10-20T10:00:00Z', 'PARTIAL'),
      attempt(4, 200, '2026-10-21T10:00:00Z', 'COMPLETED', 99),
      attempt(5, null, '2026-10-22T10:00:00Z'),
      attempt(6, 146, '2026-11-14T10:00:00Z'),
    ]
    const bars = scoreBars(list, 7, 225)
    expect(bars.map((b) => [b.id, b.pct, b.label, b.passed, b.latest])).toEqual([
      [1, 52, '12/10', false, false],
      [2, 58, '19/10', false, false],
      [6, 65, '14/11', true, true],
    ])
    const many = Array.from({ length: 8 }, (_, i) => attempt(i + 10, 100, `2026-11-0${i + 1}T10:00:00Z`))
    expect(scoreBars(many, 7, 225).map((b) => b.id)).toEqual([12, 13, 14, 15, 16, 17])
    expect(scoreBars(list, 7, 0)).toEqual([])
  })
})

describe('skillStats + planSummary — kết quả bài chẩn đoán', () => {
  test('trung bình và số kỹ năng đạt 60%', () => {
    expect(skillStats({ LESEN: 68, HOEREN: 44, SCHREIBEN: 62, SPRECHEN: 51 })).toEqual({ average: 56, passed: 2, scored: 4 })
    expect(skillStats({})).toEqual({ average: null, passed: 0, scored: 0 })
  })

  test('số tuần, phút mỗi ngày, số lần thi thử của lịch đang chạy', () => {
    const plan = {
      status: 'ACTIVE',
      totalWeeks: 10,
      weeklyMinutes: 210,
      warnings: [],
      weeks: [
        { weekNo: 1, tasks: [{ type: 'DIAGNOSTIC_EXAM' }, { type: 'ORAL_MOCK' }] },
        { weekNo: 5, tasks: [{ type: 'FULL_EXAM' }] },
        { weekNo: 9, tasks: [{ type: 'FULL_EXAM' }] },
      ],
    } as unknown as ExamPlan
    const s = planSummary(plan)
    expect(s).toEqual({ weeks: 10, daily: 30, mocks: 3 })
    expect(planLine(s!)).toBe('10 tuần · 30 phút mỗi ngày · 3 lần thi thử')
    expect(planLine({ weeks: 4, daily: null, mocks: 0 })).toBe('4 tuần')
    expect(planSummary({ ...plan, status: 'NEEDS_DATE' })).toBeNull()
    expect(planSummary(null)).toBeNull()
  })
})
