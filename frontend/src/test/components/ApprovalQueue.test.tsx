import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalQueue } from '@/app/v2/org/schedule/ApprovalQueue'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const listMock = vi.fn()
const approveMock = vi.fn()
const rejectMock = vi.fn()
const previewMock = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()
let ownerFlag: boolean | null = true

vi.mock('@/lib/scheduleChangeRequestApi', () => ({
  listPendingChangeRequests: (...a: unknown[]) => listMock(...a),
  approveChangeRequest: (...a: unknown[]) => approveMock(...a),
  rejectChangeRequest: (...a: unknown[]) => rejectMock(...a),
  getChangeRequestPreview: (...a: unknown[]) => previewMock(...a),
}))

vi.mock('@/lib/api', () => ({
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định'),
}))

vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}))

vi.mock('next-intl', () => ({
  // t(key) → key; t(key, values) giữ key để assert ổn định.
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`.replace('v2.org.schedule.requests.', '')
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

vi.mock('@/app/v2/org/OwnerOnly', () => ({
  useIsOrgOwner: () => ownerFlag,
}))

const request = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 5,
  classId: 1,
  className: 'A1 Sáng',
  requestType: 'ADD_MAKEUP',
  payload: {},
  impactSnapshot: { affectedSessionIds: [9], plannedContentCount: 2, warnings: [] },
  reason: null,
  hasWeekend: false,
  status: 'PENDING',
  requestedBy: 7,
  requestedByName: 'Cô Lan',
  requestedAt: '2026-09-01T08:00:00',
  reviewedBy: null,
  reviewedAt: null,
  rejectReason: null,
  appliedAt: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  ownerFlag = true
  listMock.mockResolvedValue([request()])
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ApprovalQueue — hàng chờ duyệt thay đổi lịch (PR-6)', () => {
  it('renders a pending request with approve/reject and calls approve', async () => {
    const user = userEvent.setup()
    approveMock.mockResolvedValue(request({ status: 'APPROVED' }))
    render(<ApprovalQueue />)

    await waitFor(() => expect(screen.getByText('A1 Sáng')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /approve$/ }))

    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(5))
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('AC19/20/23: weekend request hides the approve button for non-owners and shows the owner-only note', async () => {
    ownerFlag = false
    listMock.mockResolvedValue([request({ hasWeekend: true })])
    render(<ApprovalQueue />)

    await waitFor(() => expect(screen.getByText('A1 Sáng')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /approve$/ })).not.toBeInTheDocument()
    expect(screen.getByText('weekendOwnerOnly')).toBeInTheDocument()
    // Từ chối vẫn mở cho người duyệt thường (không đổi lịch).
    expect(screen.getByRole('button', { name: /reject$/ })).toBeInTheDocument()
  })

  it('AC22: reject requires a reason — empty reason blocks, filled reason submits', async () => {
    const user = userEvent.setup()
    rejectMock.mockResolvedValue(request({ status: 'REJECTED' }))
    render(<ApprovalQueue />)

    await waitFor(() => expect(screen.getByText('A1 Sáng')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /reject$/ }))
    // Nút xác nhận từ chối disable khi chưa có lý do.
    expect(screen.getByRole('button', { name: 'rejectConfirm' })).toBeDisabled()

    await user.type(screen.getByPlaceholderText('reasonPlaceholder'), 'Trùng lịch phòng')
    await user.click(screen.getByRole('button', { name: 'rejectConfirm' }))

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith(5, 'Trùng lịch phòng'))
  })

  it('renders nothing at all when the queue is empty (no dead section on the schedule page)', async () => {
    listMock.mockResolvedValue([])
    const { container } = render(<ApprovalQueue />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    await waitFor(() => expect(container.firstChild).toBeNull())
  })
})
