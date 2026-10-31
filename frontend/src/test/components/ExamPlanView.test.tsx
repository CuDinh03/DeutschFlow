/**
 * LT3 — màn lộ trình đếm ngược. Khoá các trạng thái của kế hoạch, chỗ khoá gói, "Sắp có", và lối đi
 * của từng loại việc. Backend đã có test riêng cho cách chia tuần và cách chấm tiến độ.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExamPlanView } from '@/components/exam/plan/ExamPlanView'
import { currentWeekOf, taskHref, type ExamPlan, type ExamPlanTask, type ExamPlanWeek } from '@/lib/examPlanApi'

vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock())
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/exam/strategy/TeilStrategy', () => ({ TeilStrategy: () => null }))

const task = (over: Partial<ExamPlanTask> & Pick<ExamPlanTask, 'type'>): ExamPlanTask => ({
  target: 1,
  doneCount: 0,
  done: false,
  counted: true,
  locked: false,
  comingSoon: false,
  ...over,
})

const week = (over: Partial<ExamPlanWeek> = {}): ExamPlanWeek => ({
  weekNo: 1,
  startDate: '2026-11-02',
  endDate: '2026-11-08',
  phase: 'TEIL',
  focus: [{ section: 'HOEREN', teil: 2 }],
  tasks: [
    task({ type: 'ROADMAP_NODES', target: 3, doneCount: 1 }),
    task({ type: 'ORAL_DRILL', teil: 2, doneCount: 1, done: true }),
    task({ type: 'WEAKNESS_REVIEW', counted: false }),
  ],
  doneTasks: 1,
  totalTasks: 2,
  ...over,
})

const plan = (over: Partial<ExamPlan> = {}): ExamPlan => ({
  status: 'ACTIVE',
  provider: 'TELC',
  level: 'B1',
  targetDate: '2026-12-28',
  daysLeft: 56,
  totalWeeks: 8,
  currentWeek: 1,
  weeklyMinutes: 200,
  warnings: [],
  weeks: [week(), week({ weekNo: 2, startDate: '2026-11-09', endDate: '2026-11-15', phase: 'FULL', focus: [] })],
  ...over,
})

const noSave = () => Promise.resolve(null)

describe('ExamPlanView', () => {
  it('hiện đếm ngược, tuần hiện tại và cả kế hoạch', () => {
    render(<ExamPlanView plan={plan()} onSaveDate={noSave} />)
    expect(screen.getByText('Còn 56 ngày tới kỳ thi')).toBeTruthy()
    expect(screen.getByText('Tuần này')).toBeTruthy()
    expect(screen.getByText('Luyện Nói Teil 2')).toBeTruthy()
    expect(screen.getByText('Hoàn thành 3 bài trên lộ trình')).toBeTruthy()
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(screen.getByText('Tuần 2 · Đề full')).toBeTruthy()
    expect(screen.getByText('Gợi ý, không tính vào tiến độ')).toBeTruthy()
  })

  it('không có nút tick tay: việc đã xong chỉ có nhãn, không có nút bấm', () => {
    render(<ExamPlanView plan={plan()} onSaveDate={noSave} />)
    expect(screen.getByText('Đã xong')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('việc cần gói hiện nhãn khoá thay vì nút bắt đầu', () => {
    const locked = week({ tasks: [task({ type: 'FULL_EXAM', locked: true, examId: 9 })], totalTasks: 1, doneTasks: 0 })
    render(<ExamPlanView plan={plan({ weeks: [locked] })} onSaveDate={noSave} />)
    expect(screen.getByText('Cần gói trả phí').closest('a')?.getAttribute('href')).toBe('/v2/student/mock-exam')
    expect(screen.queryByText('Bắt đầu')).toBeNull()
  })

  it('hết đề chưa làm thì ghi "Sắp có", không có đường vào đề cũ', () => {
    const soon = week({ tasks: [task({ type: 'FULL_EXAM', counted: false, comingSoon: true })], totalTasks: 0, doneTasks: 0 })
    render(<ExamPlanView plan={plan({ weeks: [soon] })} onSaveDate={noSave} />)
    expect(screen.getByText('Sắp có')).toBeTruthy()
    expect(screen.getByText(/Đề full tiếp theo sắp có/)).toBeTruthy()
    expect(screen.queryByText('Bắt đầu')).toBeNull()
  })

  it('in cảnh báo kèm nhịp học thật', () => {
    render(<ExamPlanView plan={plan({ warnings: ['LOW_WEEKLY_TIME'], weeklyMinutes: 90 })} onSaveDate={noSave} />)
    expect(screen.getByText(/90 phút mỗi tuần/)).toBeTruthy()
  })

  it('ngày thi là hôm nay', () => {
    render(<ExamPlanView plan={plan({ daysLeft: 0 })} onSaveDate={noSave} />)
    expect(screen.getByText('Hôm nay là ngày thi')).toBeTruthy()
  })

  it('thiếu ngày thi: lưu được ngày', async () => {
    const onSave = vi.fn(noSave)
    render(<ExamPlanView plan={plan({ status: 'NEEDS_DATE', weeks: [] })} onSaveDate={onSave} />)
    expect(screen.getByText('Thêm ngày thi để có lộ trình theo tuần')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Ngày thi'), { target: { value: '2027-02-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ngày thi' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('2027-02-10'))
  })

  it('lưu ngày lỗi thì hiện thông báo của backend', async () => {
    render(<ExamPlanView plan={plan({ status: 'NEEDS_DATE', weeks: [] })} onSaveDate={() => Promise.resolve('Ngày không hợp lệ')} />)
    fireEvent.change(screen.getByLabelText('Ngày thi'), { target: { value: '2027-02-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu ngày thi' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Ngày không hợp lệ')).toBeTruthy()
  })

  it('ngày thi đã qua mời nhập ngày mới', () => {
    render(<ExamPlanView plan={plan({ status: 'EXAM_PASSED', weeks: [] })} onSaveDate={noSave} />)
    expect(screen.getByText('Ngày thi đã qua')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lưu ngày thi' })).toBeTruthy()
  })

  it('kỳ thi chưa có kế hoạch thì nói rõ, không có ô nhập ngày', () => {
    render(<ExamPlanView plan={plan({ status: 'UNAVAILABLE', weeks: [] })} onSaveDate={noSave} />)
    expect(screen.getByText('Chưa có lộ trình cho kỳ thi này')).toBeTruthy()
    expect(screen.queryByLabelText('Ngày thi')).toBeNull()
  })

  it('có câu không cam kết kết quả thi', () => {
    render(<ExamPlanView plan={plan()} onSaveDate={noSave} />)
    expect(screen.getByText(/không phải cam kết về kết quả thi/)).toBeTruthy()
  })
})

describe('examPlanApi helpers', () => {
  const where = { provider: 'TELC', level: 'B1' }

  it('tuần hiện tại lấy theo currentWeek', () => {
    expect(currentWeekOf(plan({ currentWeek: 2 }))?.weekNo).toBe(2)
    expect(currentWeekOf(plan({ currentWeek: 9 }))).toBeUndefined()
  })

  it('mỗi loại việc dẫn tới tính năng có sẵn', () => {
    expect(taskHref(task({ type: 'FULL_EXAM', examId: 12 }), where)).toBe('/v2/student/mock-exam/run?examId=12&level=B1')
    expect(taskHref(task({ type: 'DIAGNOSTIC_EXAM', examId: 3 }), where)).toBe('/v2/student/mock-exam/run?examId=3&level=B1')
    expect(taskHref(task({ type: 'ORAL_DRILL', teil: 2 }), where)).toBe('/v2/student/speaking/exam?provider=TELC&level=B1')
    expect(taskHref(task({ type: 'ORAL_MOCK' }), where)).toBe('/v2/student/speaking/exam?provider=TELC&level=B1')
    expect(taskHref(task({ type: 'ROADMAP_NODES' }), where)).toBe('/v2/student/roadmap')
    expect(taskHref(task({ type: 'WEAKNESS_REVIEW' }), where)).toBe('/v2/student/speaking/exam/weakness')
  })

  it('đề không gán được thì không có đường đi', () => {
    expect(taskHref(task({ type: 'FULL_EXAM' }), where)).toBeNull()
  })

  it('việc bị khoá dẫn về catalog bộ đề, nơi có lối nâng cấp', () => {
    expect(taskHref(task({ type: 'ORAL_MOCK', locked: true }), where)).toBe('/v2/student/mock-exam')
  })
})
