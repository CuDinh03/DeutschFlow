import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listInvitations = vi.hoisted(() => vi.fn())
const revokeInvitation = vi.hoisted(() => vi.fn())
const rotateInvitation = vi.hoisted(() => vi.fn())
const getOrgSummary = vi.hoisted(() => vi.fn())

vi.mock('@/lib/orgApi', () => ({
  listInvitations: () => listInvitations(),
  revokeInvitation: (...a: unknown[]) => revokeInvitation(...a),
  rotateInvitation: (...a: unknown[]) => rotateInvitation(...a),
  inviteTeacher: vi.fn(),
  getOrgSummary: () => getOrgSummary(),
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

import V2OrgInvitationsPage from '@/app/v2/org/invitations/page'

const invite = {
  id: 11,
  email: 'gv@tt.vn',
  role: 'TEACHER' as const,
  status: 'PENDING' as const,
  expiresAt: '2026-09-20T00:00:00Z',
  createdAt: '2026-09-01T00:00:00Z',
}

beforeEach(() => {
  listInvitations.mockReset()
  revokeInvitation.mockReset()
  rotateInvitation.mockReset()
  getOrgSummary.mockReset()
  listInvitations.mockResolvedValue([invite])
  getOrgSummary.mockResolvedValue({ name: 'TT A', seatUsed: 1, seatLimit: 10 })
})

/**
 * V-10 — cả "Thu hồi" lẫn "Gửi lại" đều GIẾT link đang lưu hành (gửi lại xoay token: link cũ chết
 * ngay), nhưng trước đây bấm là chạy thẳng. Các ca dưới đây khoá lại hộp thoại xác nhận.
 */
describe('V2OrgInvitationsPage — xác nhận thu hồi / gửi lại lời mời', () => {
  it('Thu hồi mở hộp thoại nêu "link chết + phải mời lại", chưa gọi máy chủ', async () => {
    render(<V2OrgInvitationsPage />)
    await waitFor(() => expect(screen.getByText('gv@tt.vn')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.invitations.revoke' }))

    expect(screen.getByText('v2.org.invitations.revokeConfirmLinkDead')).toBeTruthy()
    expect(screen.getByText('v2.org.invitations.revokeConfirmReinvite')).toBeTruthy()
    expect(revokeInvitation).not.toHaveBeenCalled()
  })

  it('Huỷ trong hộp thoại thu hồi KHÔNG gọi revokeInvitation', async () => {
    render(<V2OrgInvitationsPage />)
    await waitFor(() => expect(screen.getByText('gv@tt.vn')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.invitations.revoke' }))
    await userEvent.click(screen.getByRole('button', { name: 'v2.common.cancel' }))

    await waitFor(() => expect(screen.queryByText('v2.org.invitations.revokeConfirmLinkDead')).toBeNull())
    expect(revokeInvitation).not.toHaveBeenCalled()
  })

  it('xác nhận thu hồi mới gọi revokeInvitation đúng id', async () => {
    revokeInvitation.mockResolvedValue(undefined)
    render(<V2OrgInvitationsPage />)
    await waitFor(() => expect(screen.getByText('gv@tt.vn')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.invitations.revoke' }))
    const btns = screen.getAllByRole('button', { name: 'v2.org.invitations.revoke' })
    await userEvent.click(btns[btns.length - 1])

    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith(11))
  })

  it('Gửi lại hỏi trước và nói rõ link cũ chết ngay; xác nhận mới xoay token', async () => {
    rotateInvitation.mockResolvedValue({ ...invite })
    render(<V2OrgInvitationsPage />)
    await waitFor(() => expect(screen.getByText('gv@tt.vn')).toBeTruthy())

    await userEvent.click(screen.getByRole('button', { name: 'v2.org.invitations.resend' }))
    expect(screen.getByText('v2.org.invitations.resendConfirmRotate')).toBeTruthy()
    expect(screen.getByText('v2.org.invitations.resendConfirmExpiry')).toBeTruthy()
    expect(rotateInvitation).not.toHaveBeenCalled()

    const btns = screen.getAllByRole('button', { name: 'v2.org.invitations.resend' })
    await userEvent.click(btns[btns.length - 1])

    await waitFor(() => expect(rotateInvitation).toHaveBeenCalledWith(11))
  })
})
