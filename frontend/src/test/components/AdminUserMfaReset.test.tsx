/**
 * 2FA ADMIN (09/11/2026) — "Đặt lại 2FA" trên hồ sơ người dùng (/v2/admin/users/[id] → UserAccessPanel).
 *
 * Chỉ hiện khi người đích là ADMIN và KHÔNG phải chính mình (backend cũng trả 403 cho tự đặt lại). Click chỉ
 * mở ConfirmDialog tông danger, bắt buộc lý do; xác nhận mới POST /admin/users/{id}/mfa/reset kèm lý do.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { UserAccessPanel } from '@/app/v2/admin/users/_components/UserAccessPanel'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, patch: mocks.patch, post: mocks.post },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))

const REASON = 'Mất điện thoại, đã xác minh qua gọi video'

function renderPanel(overrides: Partial<React.ComponentProps<typeof UserAccessPanel>> = {}) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <UserAccessPanel
        userId={7}
        userName="Quản trị B"
        email="b@x.com"
        role="ADMIN"
        isActive
        onChanged={() => {}}
        {...overrides}
      />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.post.mockResolvedValue({ data: { userId: 7, hadMfa: true, revokedSessions: 1 } })
})

describe('UserAccessPanel — đặt lại 2FA', () => {
  it('người đích ADMIN (không phải mình): có nút; xác nhận + lý do mới POST reset', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    renderPanel({ onChanged })

    await user.click(screen.getByRole('button', { name: 'Đặt lại 2FA' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Đặt lại xác thực hai lớp?')).toBeTruthy()
    expect(mocks.post).not.toHaveBeenCalled()

    const confirm = within(dialog).getByRole('button', { name: 'Đặt lại 2FA' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true) // thiếu lý do
    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(confirm)

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/users/7/mfa/reset', { reason: REASON }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('hồ sơ của CHÍNH MÌNH: không có nút đặt lại 2FA', () => {
    renderPanel({ isSelf: true })
    expect(screen.queryByTestId('user-mfa-reset')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đặt lại 2FA' })).toBeNull()
  })

  it('người đích không phải ADMIN: không có nút đặt lại 2FA', () => {
    renderPanel({ role: 'TEACHER' })
    expect(screen.queryByTestId('user-mfa-reset')).toBeNull()
  })

  it('gỡ khoá nhập sai 2FA: hộp xác nhận + lý do → POST unlock, báo số lần sai đã xoá', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mocks.post.mockResolvedValueOnce({ data: { userId: 7, clearedFailures: 5 } })
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Gỡ khoá nhập sai 2FA' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Gỡ khoá nhập sai 2FA?')).toBeTruthy()
    expect(within(dialog).getByText(/xác minh đúng là người này/)).toBeTruthy()
    const confirm = within(dialog).getByRole('button', { name: 'Gỡ khoá' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true) // thiếu lý do
    await user.type(within(dialog).getByTestId('confirm-reason'), 'Gõ nhầm mã nhiều lần, đã gọi xác minh')
    await user.click(confirm)

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/admin/users/7/mfa/unlock', { reason: 'Gõ nhầm mã nhiều lần, đã gọi xác minh' }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã gỡ khoá: xoá 5 lần nhập sai'))
    expect(mocks.post).not.toHaveBeenCalledWith('/admin/users/7/mfa/reset', expect.anything())
  })

  it('gỡ khoá khi không có lần sai nào → câu "không bị tính lần nhập sai nào"', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mocks.post.mockResolvedValueOnce({ data: { userId: 7, clearedFailures: 0 } })
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Gỡ khoá nhập sai 2FA' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByTestId('confirm-reason'), 'Kiểm tra trước khi hỗ trợ người dùng')
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ khoá' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Người này hiện không bị tính lần nhập sai nào'))
  })

  it('hồ sơ của CHÍNH MÌNH: không có nút gỡ khoá', () => {
    renderPanel({ isSelf: true })
    expect(screen.queryByRole('button', { name: 'Gỡ khoá nhập sai 2FA' })).toBeNull()
  })

  it('bấm Hủy trong hộp xác nhận thì không gọi API', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: 'Đặt lại 2FA' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    expect(mocks.post).not.toHaveBeenCalled()
  })
})
