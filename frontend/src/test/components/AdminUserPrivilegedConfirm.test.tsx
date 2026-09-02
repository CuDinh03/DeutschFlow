/**
 * Audit F-M11 (03/09/2026) — thao tác đặc quyền trong màn quản lý người dùng từng bắn thẳng.
 *
 * Gán vai trò (kể cả lên ADMIN) và khóa tài khoản đều gọi API ngay khi click, không hộp xác nhận
 * nào — trái chuẩn "mọi thao tác nguy hiểm phải có ConfirmDialog". Sau bản vá F-H3, khóa tài khoản
 * còn chấm dứt mọi phiên đang chạy của người đó, nên bấm nhầm càng đắt.
 *
 * Mở khóa thì KHÔNG hỏi lại — nó khôi phục quyền truy cập chứ không lấy đi.
 *
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { UserDetailModal } from '@/app/v2/admin/users/UserDetailModal'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, patch: mocks.patch },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})

function renderModal(overrides: Partial<React.ComponentProps<typeof UserDetailModal>> = {}) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <UserDetailModal
        userId={42}
        userName="Nguyễn Văn A"
        email="a@x.com"
        role="STUDENT"
        isActive
        plans={[]}
        onClose={() => {}}
        onSaved={() => {}}
        {...overrides}
      />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ data: null })
  mocks.patch.mockResolvedValue({ data: {} })
})
afterEach(() => vi.restoreAllMocks())

describe('UserDetailModal — xác nhận trước thao tác đặc quyền', () => {
  it('gán ADMIN: click "Đổi" chỉ MỞ hộp xác nhận, chưa gọi API', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Vai trò hệ thống'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: 'Đổi' }))

    expect(await screen.findByText('Đổi vai trò hệ thống?')).toBeTruthy()
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('gán ADMIN: hộp xác nhận nêu rõ hệ quả toàn quyền và cắt phiên', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Vai trò hệ thống'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: 'Đổi' }))

    await screen.findByText('Đổi vai trò hệ thống?')
    expect(screen.getByText(/toàn quyền trên mọi tổ chức/i)).toBeTruthy()
    expect(screen.getByText(/phiên đăng nhập hiện tại .* bị chấm dứt/i)).toBeTruthy()
  })

  it('gán ADMIN: chỉ sau khi xác nhận mới PATCH /role', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Vai trò hệ thống'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: 'Đổi' }))
    await user.click(await screen.findByRole('button', { name: 'Đổi vai trò' }))

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/role', { role: 'ADMIN' }),
    )
  })

  it('gán ADMIN: bấm Hủy trong hộp xác nhận thì KHÔNG gọi API', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.selectOptions(screen.getByLabelText('Vai trò hệ thống'), 'ADMIN')
    await user.click(screen.getByRole('button', { name: 'Đổi' }))
    await screen.findByText('Đổi vai trò hệ thống?')
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])

    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('khóa tài khoản: click chỉ mở hộp xác nhận, xác nhận rồi mới PATCH active=false', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Khóa tài khoản' }))
    expect(await screen.findByText('Khóa tài khoản này?')).toBeTruthy()
    expect(mocks.patch).not.toHaveBeenCalled()

    // Nút xác nhận trong hộp thoại trùng nhãn với nút mở — lấy cái cuối (nằm trong dialog).
    const confirmButtons = screen.getAllByRole('button', { name: 'Khóa tài khoản' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/active', { active: false }),
    )
  })

  it('MỞ khóa tài khoản: không hỏi lại — khôi phục quyền truy cập, không phải thao tác hủy hoại', async () => {
    const user = userEvent.setup()
    renderModal({ isActive: false })
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Mở khóa tài khoản' }))

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/active', { active: true }),
    )
    expect(screen.queryByText('Khóa tài khoản này?')).toBeNull()
  })

  it('mật khẩu admin đặt hộ không hiển thị rõ trên màn hình', async () => {
    renderModal()
    await waitFor(() => expect(mocks.get).toHaveBeenCalled())

    const pw = screen.getByPlaceholderText(/Mật khẩu mới/i) as HTMLInputElement
    expect(pw.type).toBe('password')
  })
})
