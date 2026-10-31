jest.mock('../api', () => ({ __esModule: true, default: {} }))
let mockPaywallEnabled = true
jest.mock('../paywall', () => ({
  get PAYWALL_ENABLED() {
    return mockPaywallEnabled
  },
}))

import {
  currentWeekOf,
  displayDate,
  focusLabel,
  parseExamDate,
  taskLabel,
  taskMeta,
  taskRoute,
  warningText,
  type ExamPlan,
  type ExamPlanTask,
} from '../examPlanApi'

const task = (over: Partial<ExamPlanTask> & Pick<ExamPlanTask, 'type'>): ExamPlanTask => ({
  target: 1,
  doneCount: 0,
  done: false,
  counted: true,
  locked: false,
  comingSoon: false,
  ...over,
})

const where = { provider: 'TELC', level: 'B1' }

describe('lộ trình đếm ngược LT3', () => {
  it('tuần hiện tại lấy theo currentWeek', () => {
    const week = { weekNo: 2 } as ExamPlan['weeks'][number]
    const plan = { status: 'ACTIVE', warnings: [], weeks: [week], currentWeek: 2 } as ExamPlan
    expect(currentWeekOf(plan)).toBe(week)
    expect(currentWeekOf({ ...plan, currentWeek: 3 })).toBeUndefined()
  })

  it('mỗi loại việc dẫn tới tính năng có sẵn', () => {
    expect(taskRoute(task({ type: 'FULL_EXAM', examId: 5 }), where)).toEqual({
      pathname: '/(student)/exam',
      params: { level: 'B1' },
    })
    expect(taskRoute(task({ type: 'ORAL_DRILL', teil: 2 }), where)).toEqual({
      pathname: '/(student)/speaking-exam',
      params: { provider: 'TELC', level: 'B1' },
    })
    expect(taskRoute(task({ type: 'ROADMAP_NODES' }), where)).toBe('/(student)/lernweg')
    expect(taskRoute(task({ type: 'WEAKNESS_REVIEW' }), where)).toBe('/(student)/speaking-exam-weakness')
  })

  it('không có đường đi khi hết đề hoặc đề không gán được', () => {
    expect(taskRoute(task({ type: 'FULL_EXAM', comingSoon: true, counted: false }), where)).toBeNull()
    expect(taskRoute(task({ type: 'FULL_EXAM' }), where)).toBeNull()
  })

  it('việc bị khoá dẫn tới màn nâng cấp', () => {
    expect(taskRoute(task({ type: 'ORAL_MOCK', locked: true }), where)).toBe('/(student)/upgrade')
  })

  it('việc bị khoá không có đường đi khi tắt paywall', () => {
    mockPaywallEnabled = false
    expect(taskRoute(task({ type: 'ORAL_MOCK', locked: true }), where)).toBeNull()
    mockPaywallEnabled = true
  })

  it('chữ của việc theo số liệu thật', () => {
    expect(taskLabel(task({ type: 'ORAL_DRILL', teil: 3 }))).toBe('Luyện Nói Teil 3')
    expect(taskLabel(task({ type: 'ROADMAP_NODES', target: 2 }))).toBe('Hoàn thành 2 bài trên lộ trình')
    expect(taskMeta(task({ type: 'ROADMAP_NODES', target: 2, doneCount: 5 }))).toBe('2/2')
    expect(taskMeta(task({ type: 'FULL_EXAM', examTitle: 'Đề số 2' }))).toBe('Đề số 2')
    expect(taskMeta(task({ type: 'WEAKNESS_REVIEW', counted: false }))).toContain('không tính vào tiến độ')
    expect(taskMeta(task({ type: 'FULL_EXAM', comingSoon: true, counted: false }))).toContain('sắp có')
  })

  it('tên Teil dùng nhãn tiếng Việt, không lộ mã máy', () => {
    expect(focusLabel({ section: 'SPRACHBAUSTEINE', teil: 1 })).toBe('Ngữ pháp – từ vựng · Teil 1')
  })

  it('cảnh báo có nhịp học thật, mã lạ thì bỏ qua', () => {
    expect(warningText('LOW_WEEKLY_TIME', 90)).toContain('90 phút mỗi tuần')
    expect(warningText('LEVEL_GAP', 90)).toContain('dời ngày thi')
    expect(warningText('MA_LA', 90)).toBeNull()
  })

  it('đổi ngày sang dạng dễ đọc', () => {
    expect(displayDate('2027-03-15')).toBe('15/03/2027')
    expect(displayDate(undefined)).toBe('')
  })
})

describe('parseExamDate', () => {
  it('nhận ngày hợp lệ và thêm số 0', () => {
    expect(parseExamDate('5/3/2027')).toEqual({ iso: '2027-03-05' })
    expect(parseExamDate(' 15.03.2027 ')).toEqual({ iso: '2027-03-15' })
    expect(parseExamDate('15-03-2027')).toEqual({ iso: '2027-03-15' })
  })

  it('từ chối sai dạng', () => {
    expect(parseExamDate('2027-03-15')).toHaveProperty('error')
    expect(parseExamDate('')).toHaveProperty('error')
    expect(parseExamDate('15/03')).toHaveProperty('error')
  })

  it('bắt ngày không tồn tại thay vì để Date tràn sang tháng sau', () => {
    expect(parseExamDate('31/02/2027')).toEqual({ error: 'Ngày này không có trong lịch.' })
    expect(parseExamDate('10/13/2027')).toEqual({ error: 'Ngày này không có trong lịch.' })
  })
})
