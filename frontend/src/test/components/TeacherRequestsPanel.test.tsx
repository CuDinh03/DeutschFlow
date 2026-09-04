import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TeacherRequestsPanel } from '@/app/v2/teacher/schedule/TeacherRequestsPanel'

const listMock = vi.fn()
const cancelMock = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/lib/scheduleChangeRequestApi', () => ({
  listClassChangeRequests: (...a: unknown[]) => listMock(...a),
  cancelChangeRequest: (...a: unknown[]) => cancelMock(...a),
  getClassForecast: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định'),
}))

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`.replace('v2.teacher.schedule.requests.', '')
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

const CLASSES = [{ id: 1, name: 'A1 Sáng', studentCount: 8 }]

const request = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 12,
  classId: 1,
  className: 'A1 Sáng',
  requestType: 'MOVE_SESSION',
  payload: {},
  impactSnapshot: null,
  reason: null,
  hasWeekend: false,
  status: 'PENDING',
  requestedBy: 7,
  requestedByName: 'Tôi',
  requestedAt: '2026-09-01T08:00:00',
  reviewedBy: null,
  reviewedAt: null,
  rejectReason: null,
  appliedAt: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue([request()])
})

describe('TeacherRequestsPanel — đề xuất của giáo viên (PR-6)', () => {
  it('withdraws a PENDING request only after confirming in the dialog (§2.11)', async () => {
    const user = userEvent.setup()
    cancelMock.mockResolvedValue(undefined)
    render(<TeacherRequestsPanel classes={CLASSES} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1))
    await user.click(await screen.findByRole('button', { name: 'withdraw' }))
    // Dialog mở, CHƯA rút.
    expect(cancelMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'withdrawConfirm' }))

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(12))
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('REJECTED request shows the reason and offers no withdraw button', async () => {
    listMock.mockResolvedValue([request({ status: 'REJECTED', rejectReason: 'Trùng phòng' })])
    render(<TeacherRequestsPanel classes={CLASSES} />)

    await waitFor(() => expect(screen.getByText('status.REJECTED')).toBeInTheDocument())
    expect(screen.getByText(/rejectedReason/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'withdraw' })).not.toBeInTheDocument()
  })
})
