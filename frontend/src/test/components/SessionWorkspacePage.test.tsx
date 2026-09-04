import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Page from '@/app/v2/teacher/session/[id]/page'

const getWs = vi.fn()
const completeMock = vi.fn()
const uncompleteMock = vi.fn()
const createLogMock = vi.fn()
const updateLogMock = vi.fn()
const toastSuccess = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '55' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/sessionWorkspaceApi', () => ({
  getSessionWorkspace: (...a: unknown[]) => getWs(...a),
  completeSession: (...a: unknown[]) => completeMock(...a),
  uncompleteSession: (...a: unknown[]) => uncompleteMock(...a),
}))

vi.mock('@/lib/teacherLessonLogApi', () => ({
  createLessonLog: (...a: unknown[]) => createLogMock(...a),
  updateLessonLog: (...a: unknown[]) => updateLogMock(...a),
}))

vi.mock('@/lib/sessionContentApi', () => ({
  confirmSessionContents: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi'),
}))

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`.replace('v2.teacher.sessionWorkspace.', '')
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

const workspace = (over: Partial<Record<string, unknown>> = {}) => ({
  sessionId: 55,
  classId: 1,
  className: 'A1 Sáng',
  startAt: '2026-08-30T08:00:00',
  durationMinutes: 195,
  teachingMinutes: 180,
  breakMinutes: 15,
  mode: 'OFFLINE',
  room: 'P.101',
  status: 'SCHEDULED',
  completedAt: null,
  completedByTeacherId: null,
  editable: true,
  unlockActive: false,
  editWindowDays: 7,
  contents: { sessionId: 55, teachingMinutes: 180, plannedTotalMinutes: 0, unallocatedCarryMinutes: 0, contents: [] },
  log: null,
  roster: [
    { studentId: 9, displayName: 'An' },
    { studentId: 10, displayName: 'Bình' },
  ],
  forecast: { remainingMinutes: 0, availableMinutes: 0, futureSessionCount: 0, projectedEndDate: null, shortfallMinutes: 0, suggestedExtraSessions: 0, milestones: [] },
  assignments: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  getWs.mockResolvedValue(workspace())
})

describe('SessionWorkspacePage — màn làm việc theo buổi (PR-7)', () => {
  it('closes the session only after confirming in the dialog (§2.11) ', async () => {
    const user = userEvent.setup()
    completeMock.mockResolvedValue(workspace({ completedAt: '2026-08-30T12:00:00' }))
    render(<Page />)

    await waitFor(() => expect(getWs).toHaveBeenCalledWith(55))
    await user.click(await screen.findByRole('button', { name: /complete$/ }))
    expect(completeMock).not.toHaveBeenCalled() // dialog trước, chốt sau
    await user.click(screen.getByRole('button', { name: 'completeConfirm' }))

    await waitFor(() => expect(completeMock).toHaveBeenCalledWith(55))
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('AC13: switching a student to ABSENT shows the needs-makeup flag and sends it explicitly on save', async () => {
    const user = userEvent.setup()
    createLogMock.mockResolvedValue({ id: 1 })
    render(<Page />)

    await waitFor(() => expect(screen.getByText('An')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText('topicPlaceholder'), 'Lektion 1')
    await user.selectOptions(screen.getAllByLabelText('statusFor')[0], 'ABSENT')
    // vắng → cờ tự bật, hiển thị checkbox
    expect(screen.getByRole('checkbox')).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'saveLogCreate' }))
    await waitFor(() => expect(createLogMock).toHaveBeenCalled())
    const body = createLogMock.mock.calls[0][1] as { attendance: { studentId: number; status: string; needsMakeup: boolean }[]; sessionId: number }
    expect(body.sessionId).toBe(55)
    expect(body.attendance.find((a) => a.studentId === 9)).toMatchObject({ status: 'ABSENT', needsMakeup: true })
    expect(body.attendance.find((a) => a.studentId === 10)).toMatchObject({ status: 'PRESENT', needsMakeup: false })
  })

  it('P07: locked session shows the banner and disables editing controls', async () => {
    getWs.mockResolvedValue(workspace({ editable: false }))
    render(<Page />)

    await waitFor(() => expect(screen.getByText(/lockedBanner/)).toBeInTheDocument())
    expect(screen.getByPlaceholderText('topicPlaceholder')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'saveLogCreate' })).toBeDisabled()
  })
})
