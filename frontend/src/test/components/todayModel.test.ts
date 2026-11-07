/** Hàm thuần của màn Hôm nay (đợt (d)): bốn kỹ năng, chọn đề mở Teil, thẻ Hôm nay, đổi chỗ lạc quan. */
import { describe, expect, it } from 'vitest'
import { latestOral, pickExamFor, skillsFrom, statusOf, suggestionsFor, todayCard } from '@/components/exam/today/todayModel'
import { localIsoDate, swapLocally, teilKeyOf, todaySession, type ExamPlan } from '@/lib/examPlanApi'
import type { PracticeOverview, PracticeProgress } from '@/lib/telcPracticeApi'
import type { ExamResultView } from '@/types/exam-speaking'

const prog = (score: number, max: number, at: string, checked = true): PracticeProgress => ({
  answers: { a: 'x' }, checked, score, max, elapsedSeconds: 0, updatedAt: at, result: null,
})
const teil = (key: string, p: PracticeProgress | null, maxPoints = 25) => {
  const [section, n] = key.split('-')
  return { key, section, teil: Number(n), type: null, items: 5, maxPoints, suggestMinutes: 12, progress: p }
}
const ov = (examId: number, teile: PracticeOverview['teile']): PracticeOverview => ({ examId, title: `Đề ${examId}`, level: 'B1', format: 'TELC', sectionsJson: '{}', teile })

const A = ov(1, [teil('LESEN-1', prog(20, 25, '2026-11-01')), teil('LESEN-2', prog(5, 25, '2026-11-02')), teil('SPRACHBAUSTEINE-1', prog(15, 15, '2026-11-02'), 15), teil('HOEREN-1', null)])
const B = ov(2, [teil('LESEN-1', prog(10, 25, '2026-11-05')), teil('LESEN-2', null), teil('HOEREN-1', prog(1, 25, '2026-11-01', false))])

describe('todayModel', () => {
  it('kỹ năng lấy lần kiểm tra GẦN NHẤT mỗi Teil qua mọi đề; Sprachbausteine thuộc Lesen', () => {
    const [lesen, hoeren, schreiben] = skillsFrom([A, B], null)
    // LESEN-1 gần nhất là đề 2 (10/25), LESEN-2 5/25, SB-1 15/15 ⇒ 30/65
    expect(lesen.pct).toBe(46)
    expect(lesen.status).toBe('below')
    expect(lesen.teile.map((x) => x.key)).toEqual(['LESEN-1', 'LESEN-2', 'SPRACHBAUSTEINE-1'])
    expect(lesen.weakest?.key).toBe('LESEN-2')
    expect(hoeren.pct).toBeNull()
    expect(hoeren.weakest?.key).toBe('HOEREN-1')
    expect(schreiben.teile).toHaveLength(0)
  })

  it('Sprechen từ lần thi nói gần nhất của telc B1', () => {
    const r = (id: number, at: string, total: number | null, level = 'B1') =>
      ({ sessionId: id, provider: 'TELC', level, total, max: 75, createdAt: at, scoreSheet: { parts: [{ teilNo: 1, points: 12, max: 15 }] } }) as unknown as ExamResultView
    const oral = latestOral([r(1, '2026-10-01', 40), r(2, '2026-11-01', 50), r(3, '2026-11-03', null), r(4, '2026-11-04', 70, 'B2')])
    expect(oral?.sessionId).toBe(2)
    const sprechen = skillsFrom([], oral)[3]
    expect(sprechen.pct).toBe(67)
    expect(sprechen.teile[0]).toMatchObject({ key: 'SPRECHEN-1', pct: 80 })
  })

  it('ngưỡng trạng thái 60 / 50', () => {
    expect([statusOf(60), statusOf(55), statusOf(49), statusOf(null)]).toEqual(['ok', 'near', 'below', 'none'])
  })

  it('chọn đề: đang làm dở > chưa luyện > điểm thấp nhất', () => {
    expect(pickExamFor('HOEREN-1', [A, B])).toBe(2) // đề 2 đang làm dở
    expect(pickExamFor('LESEN-2', [A, B])).toBe(2) // đề 2 chưa luyện
    expect(pickExamFor('LESEN-1', [A, B])).toBe(2) // 10/25 < 20/25
    expect(pickExamFor('SCHREIBEN-1', [A, B])).toBeNull()
  })

  it('thẻ Hôm nay theo buổi của lịch; không có lịch thì Teil yếu nhất', () => {
    const skills = skillsFrom([A, B], null)
    const day = { date: localIsoDate(), kind: 'TEIL' as const, section: 'LESEN', teil: 2, minutes: 30, status: 'TODAY' as const, movable: true }
    expect(todayCard(day, null, [A, B], skills)).toMatchObject({ kind: 'TEIL', pct: 20, href: '/v2/student/mock-exam/practice/teil?examId=2&teil=LESEN-2', fromPlan: true })
    expect(todayCard({ ...day, kind: 'FULL_EXAM', examId: 9 }, null, [], skills)).toMatchObject({ kind: 'FULL_EXAM', href: '/v2/student/mock-exam/full?examId=9' })
    expect(todayCard({ ...day, kind: 'REST' }, null, [], skills)).toEqual({ kind: 'REST' })
    // không lịch: Hören chưa luyện (-1) xếp trước Lesen 46%
    expect(todayCard(undefined, null, [A, B], skills)).toMatchObject({ kind: 'TEIL', section: 'HOEREN', teil: 1, fromPlan: false })
  })

  it('buổi hôm nay, khoá Teil, đổi chỗ lạc quan giữ ngày và đổi trạng thái', () => {
    const today = localIsoDate()
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const tomorrow = localIsoDate(d)
    const plan: ExamPlan = {
      status: 'ACTIVE', currentWeek: 1, warnings: [],
      weeks: [{ weekNo: 1, startDate: today, endDate: tomorrow, phase: 'TEIL', focus: [], tasks: [], doneTasks: 0, totalTasks: 0, days: [
        { date: today, kind: 'TEIL', section: 'LESEN', teil: 2, minutes: 30, status: 'TODAY', movable: true },
        { date: tomorrow, kind: 'REST', minutes: 0, status: 'REST', movable: true },
      ] }],
    }
    expect(teilKeyOf(todaySession(plan))).toBe('LESEN-2')
    const next = swapLocally(plan, today, tomorrow)
    const days = next.weeks[0].days!
    expect(days[0]).toMatchObject({ date: today, kind: 'REST', status: 'REST' })
    expect(days[1]).toMatchObject({ date: tomorrow, kind: 'TEIL', section: 'LESEN', status: 'UPCOMING' })
    expect(plan.weeks[0].days![0].kind).toBe('TEIL')
  })

  it('gợi ý: ôn câu sai Teil vừa kiểm tra, Teil yếu kế tiếp, thi thử sắp tới; bỏ Teil của thẻ Hôm nay', () => {
    const withResult = (p: PracticeProgress, correctCount: number, total: number) => ({ ...p, result: { correctCount, total } as never })
    const C = ov(3, [
      teil('LESEN-1', withResult(prog(15, 25, '2026-11-06'), 3, 5)),
      teil('HOEREN-2', withResult(prog(10, 25, '2026-11-07'), 4, 10)),
      teil('SCHREIBEN-1', withResult(prog(20, 45, '2026-11-08'), 0, 1), 45),
      teil('LESEN-3', null),
    ])
    const skills = skillsFrom([C], null)
    const today = '2026-11-10'
    const plan: ExamPlan = {
      status: 'ACTIVE', currentWeek: 1, warnings: [],
      weeks: [{ weekNo: 1, startDate: today, endDate: '2026-11-16', phase: 'FULL', focus: [], tasks: [], doneTasks: 0, totalTasks: 0, days: [
        { date: '2026-11-15', kind: 'FULL_EXAM', minutes: 150, status: 'UPCOMING', movable: true, examId: 3 },
      ] }],
    }
    const out = suggestionsFor([C], skills, plan, 'LESEN-3', true, today)
    // Viết không tính "câu sai"; Teil kiểm tra gần nhất có câu sai là Hören T2
    expect(out[0]).toMatchObject({ kind: 'review', key: 'HOEREN-2', wrong: 6 })
    // LESEN-3 đang ở thẻ Hôm nay nên bỏ; Teil yếu kế tiếp: Schreiben 44% < Lesen 1 60%
    expect(out[1]).toMatchObject({ kind: 'weak', key: 'SCHREIBEN-1' })
    expect(out[2]).toMatchObject({ kind: 'mock', date: '2026-11-15', href: '/v2/student/mock-exam/full?examId=3' })
    // không có thi thử trong tuần, chưa thi nói ⇒ gợi ý thi nói
    expect(suggestionsFor([C], skills, null, null, false, today).at(-1)).toMatchObject({ kind: 'oral' })
    expect(suggestionsFor([], skillsFrom([], null), null, null, true, today)).toEqual([])
  })
})
