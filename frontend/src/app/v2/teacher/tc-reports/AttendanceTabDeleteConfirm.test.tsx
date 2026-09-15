import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const deleteLessonLog = vi.hoisted(() => vi.fn())

vi.mock('@/lib/teacherLessonLogApi', () => ({
  deleteLessonLog: (...a: unknown[]) => deleteLessonLog(...a),
  createLessonLog: vi.fn(),
  updateLessonLog: vi.fn(),
  normalizeAttendanceStatus: (s: string) => s,
}))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : '') }))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import { AttendanceTab } from '@/app/v2/teacher/tc-reports/AttendanceTab'

const log = {
  id: 3,
  classId: 1,
  sessionDate: '2026-09-05',
  sessionNumber: 4,
  topic: 'Perfekt',
  homework: null,
  note: null,
  createdAt: '2026-09-05T12:00:00Z',
  attendance: [
    { studentId: 1, name: 'A', email: 'a@x.vn', status: 'PRESENT', note: null, needsMakeup: false },
    { studentId: 2, name: 'B', email: 'b@x.vn', status: 'ABSENT', note: null, needsMakeup: false },
  ],
}

const renderTab = () =>
  render(
    <AttendanceTab
      classId={1}
      lessonLogs={[log]}
      onLessonLogsChange={vi.fn()}
      roster={[{ studentId: 1, name: 'A' }, { studentId: 2, name: 'B' }]}
      printRoster={[{ studentId: 1, name: 'A' }, { studentId: 2, name: 'B' }]}
      lessons={[]}
      classDisplayName="Lớp A1"
    />,
  )

beforeEach(() => deleteLessonLog.mockReset())

/**
 * V-10 — màn sổ điểm lớp trước đây xoá buổi học bằng `window.confirm('Xoá buổi học này?')`: trái
 * quy ước ConfirmDialog của dự án VÀ không nêu hệ quả nào. Ca dưới đây khoá lại cả hai điều.
 */
describe('AttendanceTab — xác nhận trước khi xoá buổi học', () => {
  it('bấm xoá mở ConfirmDialog nêu điểm danh + chấm công, chưa gọi máy chủ', async () => {
    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'v2.teacher.tcReports.attendance.delete' }))

    expect(
      screen.getByText('v2.teacher.tcReports.attendance.deleteConfirmAttendance:{"count":2}'),
    ).toBeTruthy()
    expect(screen.getByText('v2.teacher.tcReports.attendance.deleteConfirmTimesheet')).toBeTruthy()
    expect(deleteLessonLog).not.toHaveBeenCalled()
  })

  it('Huỷ KHÔNG xoá; xác nhận mới gọi deleteLessonLog', async () => {
    renderTab()

    await userEvent.click(screen.getByRole('button', { name: 'v2.teacher.tcReports.attendance.delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'v2.common.cancel' }))
    await waitFor(() =>
      expect(screen.queryByText('v2.teacher.tcReports.attendance.deleteConfirmTimesheet')).toBeNull(),
    )
    expect(deleteLessonLog).not.toHaveBeenCalled()

    deleteLessonLog.mockResolvedValue(undefined)
    await userEvent.click(screen.getByRole('button', { name: 'v2.teacher.tcReports.attendance.delete' }))
    const btns = screen.getAllByRole('button', { name: 'v2.teacher.tcReports.attendance.delete' })
    await userEvent.click(btns[btns.length - 1])

    await waitFor(() => expect(deleteLessonLog).toHaveBeenCalledWith(1, 3))
  })
})
