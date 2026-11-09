/**
 * Audit F-M11 (03/09/2026) — thao tác đặc quyền trong màn quản lý người dùng từng bắn thẳng.
 *
 * Gán vai trò (kể cả lên ADMIN) và khóa tài khoản đều gọi API ngay khi click, không hộp xác nhận
 * nào — trái chuẩn "mọi thao tác nguy hiểm phải có ConfirmDialog". Sau bản vá F-H3, khóa tài khoản
 * còn chấm dứt mọi phiên đang chạy của người đó, nên bấm nhầm càng đắt.
 *
 * Mở khóa thì KHÔNG hỏi lại — nó khôi phục quyền truy cập chứ không lấy đi.
 *
 * Đợt 1 admin (09/11/2026): các thao tác này chuyển từ UserDetailModal sang UserAccessPanel trên
 * trang hồ sơ /v2/admin/users/[id], và nay bắt buộc lý do (backend trả 400 nếu thiếu — AC-ADMIN-23).
 * Gán/bỏ ADMIN còn phải gõ lại email người bị đổi. Giữ đủ 7 ca của AC-ADMIN-16, thêm bước nhập.
 *
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { UserAccessPanel } from '@/app/v2/admin/users/_components/UserAccessPanel'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, patch: mocks.patch },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})

const REASON = 'Chuyển sang nhóm vận hành nội dung'

function renderPanel(overrides: Partial<React.ComponentProps<typeof UserAccessPanel>> = {}) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <UserAccessPanel
        userId={42}
        userName="Nguyễn Văn A"
        email="a@x.com"
        role="STUDENT"
        isActive
        onChanged={() => {}}
        {...overrides}
      />
    </NextIntlClientProvider>,
  )
}

async function openAdminGrant(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Vai trò hệ thống'), 'ADMIN')
  await user.click(screen.getByRole('button', { name: 'Đổi' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ data: null })
  mocks.patch.mockResolvedValue({ data: {} })
})
afterEach(() => vi.restoreAllMocks())

describe('UserAccessPanel — xác nhận trước thao tác đặc quyền', () => {
  it('gán ADMIN: click "Đổi" chỉ MỞ hộp xác nhận, chưa gọi API', async () => {
    const user = userEvent.setup()
    renderPanel()
    await openAdminGrant(user)

    expect(await screen.findByText('Đổi vai trò hệ thống?')).toBeTruthy()
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('gán ADMIN: hộp xác nhận nêu rõ hệ quả toàn quyền và cắt phiên', async () => {
    const user = userEvent.setup()
    renderPanel()
    await openAdminGrant(user)

    expect(screen.getByText(/toàn quyền trên mọi tổ chức/i)).toBeTruthy()
    expect(screen.getByText(/phiên đăng nhập hiện tại .* bị chấm dứt/i)).toBeTruthy()
  })

  it('gán ADMIN: chỉ sau khi nhập lý do + gõ đúng email và xác nhận mới PATCH /role (kèm lý do)', async () => {
    const user = userEvent.setup()
    renderPanel()
    const dialog = await openAdminGrant(user)
    const confirm = within(dialog).getByRole('button', { name: 'Đổi vai trò' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    expect(confirm.disabled).toBe(true) // còn thiếu bước gõ email
    await user.type(within(dialog).getByTestId('confirm-phrase'), 'a@x.com')
    await user.click(confirm)

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/role', { role: 'ADMIN', reason: REASON }),
    )
  })

  it('gán ADMIN: bấm Hủy trong hộp xác nhận thì KHÔNG gọi API', async () => {
    const user = userEvent.setup()
    renderPanel()
    const dialog = await openAdminGrant(user)
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))

    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('khóa tài khoản: click chỉ mở hộp xác nhận, có lý do và xác nhận rồi mới PATCH active=false', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Khóa tài khoản' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Khóa tài khoản này?')).toBeTruthy()
    expect(mocks.patch).not.toHaveBeenCalled()

    const confirm = within(dialog).getByRole('button', { name: 'Khóa tài khoản' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(confirm)

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/active', { active: false, reason: REASON }),
    )
  })

  it('MỞ khóa tài khoản: không hỏi lại — khôi phục quyền truy cập, không phải thao tác hủy hoại', async () => {
    const user = userEvent.setup()
    renderPanel({ isActive: false })

    await user.click(screen.getByRole('button', { name: 'Mở khóa tài khoản' }))

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/active', { active: true }),
    )
    expect(screen.queryByText('Khóa tài khoản này?')).toBeNull()
  })

  it('mật khẩu admin đặt hộ không hiển thị rõ; đặt lại phải qua hộp xác nhận có lý do', async () => {
    const user = userEvent.setup()
    renderPanel()

    const pw = screen.getByPlaceholderText(/Mật khẩu mới/i) as HTMLInputElement
    expect(pw.type).toBe('password')

    await user.type(pw, 'NewPass#2026')
    await user.click(screen.getByRole('button', { name: 'Đặt lại' }))
    const dialog = await screen.findByRole('dialog')
    expect(mocks.patch).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/KHÔNG nhận thông báo tự động/)).toBeTruthy()

    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }))
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith('/admin/users/42/password', { password: 'NewPass#2026', reason: REASON }),
    )
  })
})
