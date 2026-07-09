/**
 * Regression tests for AttendanceTab's attendance-preservation on edit.
 *
 * The critical bug this guards: editing a lesson log used to rebuild the saved
 * attendance array purely from the current roster, silently DROPPING attendance
 * for any student no longer in that roster (student left the class, or the roster
 * came back empty because the gradebook fetch failed). The fix merges preserved
 * out-of-roster entries into the payload. Real ui-v2/reportShared components are
 * used; only the network layer, i18n and toast are mocked.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AttendanceTab } from '@/app/v2/teacher/tc-reports/AttendanceTab'
import type { ClassLessonLog } from '@/lib/teacherLessonLogApi'

const createLessonLog = vi.fn()
const updateLessonLog = vi.fn()
const deleteLessonLog = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/teacherLessonLogApi', () => ({
  createLessonLog: (...a: unknown[]) => createLessonLog(...a),
  updateLessonLog: (...a: unknown[]) => updateLessonLog(...a),
  deleteLessonLog: (...a: unknown[]) => deleteLessonLog(...a),
}))

const log: ClassLessonLog = {
  id: 5,
  classId: 1,
  sessionDate: '2026-07-01',
  sessionNumber: 3,
  topic: 'Modalverben',
  homework: null,
  note: null,
  createdAt: '2026-07-01T00:00:00',
  attendance: [
    { studentId: 1, name: 'Anh', email: 'anh@x.com', status: 'PRESENT', note: null },
    { studentId: 99, name: 'Đã rời lớp', email: 'gone@x.com', status: 'ABSENT', note: null },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('AttendanceTab — attendance preservation on edit', () => {
  it('preserves attendance for a student who is in the log but not in the current roster', async () => {
    const user = userEvent.setup()
    updateLessonLog.mockResolvedValue({ ...log })
    const onChange = vi.fn()

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[log]}
        onLessonLogsChange={onChange}
        roster={[{ studentId: 1, name: 'Anh' }]}
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.edit' }))
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateLessonLog).toHaveBeenCalledTimes(1))
    const payload = updateLessonLog.mock.calls[0][2] as { attendance: { studentId: number; status: string }[] }
    const byId = new Map(payload.attendance.map((a) => [a.studentId, a.status]))
    // roster student still present …
    expect(byId.get(1)).toBe('PRESENT')
    // … and the out-of-roster student's record is preserved, not dropped
    expect(byId.get(99)).toBe('ABSENT')
    expect(payload.attendance).toHaveLength(2)
  })

  it('does not wipe attendance when the roster is empty (e.g. gradebook fetch failed)', async () => {
    const user = userEvent.setup()
    updateLessonLog.mockResolvedValue({ ...log })
    const onChange = vi.fn()

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[log]}
        onLessonLogsChange={onChange}
        roster={[]}
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.edit' }))
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateLessonLog).toHaveBeenCalledTimes(1))
    const payload = updateLessonLog.mock.calls[0][2] as { attendance: { studentId: number; status: string }[] }
    // both original entries survive an empty-roster edit
    expect(payload.attendance).toHaveLength(2)
    expect(payload.attendance.map((a) => a.studentId).sort()).toEqual([1, 99])
  })
})
