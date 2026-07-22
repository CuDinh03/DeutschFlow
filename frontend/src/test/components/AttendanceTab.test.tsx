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
        printRoster={[]}
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
        printRoster={[]}
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

/**
 * N-3 regression. The page used to fall back to "students seen across existing lesson logs" for the
 * roster when both enrolment endpoints failed. Those students may have LEFT the class, and the
 * backend now rejects attendance rows for non-members — so that fallback turned a degraded fetch
 * into "the teacher cannot save any journal entry at all" (a generic 400 toast, no way forward).
 *
 * Fixed shape: the log-derived list is confined to `printRoster` (printed matrix only). It can never
 * reach the marking form nor the payload; the teacher is told why marking is unavailable and can
 * still record what was taught.
 */
describe('AttendanceTab — a degraded roster never becomes attendance input', () => {
  it('explains why marking is unavailable and sends no attendance rows', async () => {
    const user = userEvent.setup()
    createLessonLog.mockResolvedValue({ ...log, id: 8, attendance: [] })

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[log]}
        onLessonLogsChange={vi.fn()}
        roster={[]}                                              // enrolment endpoints down
        printRoster={[{ studentId: 99, name: 'Đã rời lớp' }]}     // log-derived, display only
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.addLog' }))
    expect(screen.getByText('attendance.rosterUnavailable')).toBeInTheDocument()
    // No marking control is offered for the display-only student.
    expect(screen.queryByLabelText('Đã rời lớp')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('attendance.sessionDateLabel'), '2026-07-14')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(createLessonLog).toHaveBeenCalledTimes(1))
    const payload = createLessonLog.mock.calls[0][1] as { attendance: { studentId: number }[] }
    // Student #99 never reaches the wire → the backend membership guard cannot reject the save.
    expect(payload.attendance).toEqual([])
  })
})

/**
 * The audit bug: a NEW lesson log defaulted every roster student to PRESENT. A teacher who only
 * wanted to record what was taught (topic + homework) and never touched the attendance section
 * silently marked the whole class — absentees included — as present. That fabricated attendance
 * then feeds the attendance rate and the certificate gate.
 *
 * Fixed behaviour: unmarked students are UNMARKED (a draft-only value) and are simply NOT sent,
 * so no attendance row is invented. Marking is explicit — either per student, or one click on
 * "mark all present" for the common case.
 */
describe('AttendanceTab — no fabricated PRESENT on a new log', () => {
  it('sends no attendance rows when the teacher never touches the attendance section', async () => {
    const user = userEvent.setup()
    createLessonLog.mockResolvedValue({ ...log, id: 6, attendance: [] })

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[]}
        onLessonLogsChange={vi.fn()}
        roster={[
          { studentId: 1, name: 'Anh' },
          { studentId: 2, name: 'Bình' },
        ]}
        printRoster={[]}
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.addLog' }))
    await user.type(screen.getByLabelText('attendance.sessionDateLabel'), '2026-07-14')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(createLessonLog).toHaveBeenCalledTimes(1))
    const payload = createLessonLog.mock.calls[0][1] as { attendance: { studentId: number; status: string }[] }
    // NOT [{1,PRESENT},{2,PRESENT}] — nobody was marked, so nobody is recorded.
    expect(payload.attendance).toEqual([])
  })

  it('records only the students the teacher actually marked', async () => {
    const user = userEvent.setup()
    createLessonLog.mockResolvedValue({ ...log, id: 7, attendance: [] })

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[]}
        onLessonLogsChange={vi.fn()}
        roster={[
          { studentId: 1, name: 'Anh' },
          { studentId: 2, name: 'Bình' },
        ]}
        printRoster={[]}
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.addLog' }))
    await user.type(screen.getByLabelText('attendance.sessionDateLabel'), '2026-07-14')
    await user.selectOptions(screen.getByLabelText('Anh'), 'ABSENT')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(createLessonLog).toHaveBeenCalledTimes(1))
    const payload = createLessonLog.mock.calls[0][1] as { attendance: { studentId: number; status: string }[] }
    expect(payload.attendance).toEqual([{ studentId: 1, status: 'ABSENT' }])
  })

  it('"mark all present" keeps the one-click path for a fully-present class', async () => {
    const user = userEvent.setup()
    createLessonLog.mockResolvedValue({ ...log, id: 8, attendance: [] })

    render(
      <AttendanceTab
        classId={1}
        lessonLogs={[]}
        onLessonLogsChange={vi.fn()}
        roster={[
          { studentId: 1, name: 'Anh' },
          { studentId: 2, name: 'Bình' },
        ]}
        printRoster={[]}
        lessons={[]}
        classDisplayName="A1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'attendance.addLog' }))
    await user.type(screen.getByLabelText('attendance.sessionDateLabel'), '2026-07-14')
    await user.click(screen.getByRole('button', { name: 'attendance.markAllPresent' }))
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(createLessonLog).toHaveBeenCalledTimes(1))
    const payload = createLessonLog.mock.calls[0][1] as { attendance: { studentId: number; status: string }[] }
    expect(payload.attendance).toEqual([
      { studentId: 1, status: 'PRESENT' },
      { studentId: 2, status: 'PRESENT' },
    ])
  })
})
