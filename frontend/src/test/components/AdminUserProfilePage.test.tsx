/**
 * Hồ sơ người dùng /v2/admin/users/[id] (đợt 1 · GĐ3, 09/11/2026 — AC-ADMIN-26/27):
 * mở trực tiếp từ link, tab theo `?tab=`, 404 hiện trạng thái rỗng, đổi gói phải qua hộp xác nhận
 * nêu số dư ví sắp bị ảnh hưởng + lý do bắt buộc, tab Nhật ký lọc theo đúng người.
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn(), id: '42' }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/v2/admin/users/42',
  useSearchParams: () => nav.params,
  useParams: () => ({ id: nav.id }),
}))

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, patch: mocks.patch, put: vi.fn() },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})

import AdminUserProfilePage from '@/app/v2/admin/users/[id]/page'

const PROFILE = {
  id: 42,
  email: 'a@x.com',
  displayName: 'Nguyễn Văn A',
  role: 'STUDENT',
  isActive: true,
  createdAt: '2026-09-01T08:00:00',
  locale: 'vi',
  orgId: null,
  orgName: null,
  planCode: 'PRO',
  subscriptionStartsAtUtc: null,
  subscriptionEndsAtUtc: null,
}

function renderAt(query: string, id = '42') {
  nav.params = new URLSearchParams(query)
  nav.id = id
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <AdminUserProfilePage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.patch.mockResolvedValue({ data: {} })
  mocks.get.mockImplementation((url: string) => {
    if (url === '/admin/users/42') return Promise.resolve({ data: PROFILE })
    if (url === '/admin/users/42/quota') return Promise.resolve({ data: { planCode: 'PRO', quotaKind: 'WALLET', walletBalance: 1200 } })
    if (url === '/admin/plans') return Promise.resolve({ data: [{ code: 'PRO', name: 'Pro' }, { code: 'FREE', name: 'Free' }] })
    if (url === '/admin/audit') return Promise.resolve({ data: { items: [], total: 0, page: 0, size: 20 } })
    return Promise.resolve({ data: [] })
  })
})

describe('Hồ sơ người dùng admin', () => {
  it('mở trực tiếp từ link: tải hồ sơ theo id trên URL, mặc định tab Tổng quan', async () => {
    renderAt('')
    expect(await screen.findByText('Nguyễn Văn A')).toBeTruthy()
    expect(mocks.get).toHaveBeenCalledWith('/admin/users/42')
    expect(screen.getByTestId('user-plan-panel')).toBeTruthy()
  })

  it('đổi gói: hộp xác nhận nêu số dư ví sẽ bị xoá; chưa xác nhận thì chưa PATCH; có lý do mới PATCH', async () => {
    const user = userEvent.setup()
    renderAt('tab=overview')
    await screen.findByText('Nguyễn Văn A')

    await user.selectOptions(screen.getByTestId('plan-code'), 'FREE')
    await user.click(screen.getByTestId('plan-save'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1\.200 token sẽ bị xoá/)).toBeTruthy()
    expect(within(dialog).getByText(/PRO → FREE/)).toBeTruthy()
    expect(mocks.patch).not.toHaveBeenCalled()

    const confirm = within(dialog).getByRole('button', { name: 'Đổi gói' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await user.type(within(dialog).getByTestId('confirm-reason'), 'Học viên chuyển sang gói trung tâm')
    await user.click(confirm)

    await waitFor(() => expect(mocks.patch).toHaveBeenCalled())
    const [url, body] = mocks.patch.mock.calls[0]
    expect(url).toBe('/admin/users/42/plan')
    expect(body).toMatchObject({ planCode: 'FREE', reason: 'Học viên chuyển sang gói trung tâm' })
  })

  it('?tab=audit mở tab Nhật ký và chỉ hỏi vết của đúng người này', async () => {
    renderAt('tab=audit')
    await screen.findByText('Nguyễn Văn A')
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith('/admin/audit', { params: { targetUserId: 42, page: 0, size: 20 } }),
    )
    expect(await screen.findByText('Chưa có thao tác nào với người dùng này.')).toBeTruthy()
  })

  it('id không tồn tại → trạng thái rỗng "Không tìm thấy người dùng", không treo spinner', async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === '/admin/users/999') return Promise.reject({ isAxiosError: true, response: { status: 404 } })
      return Promise.resolve({ data: [] })
    })
    renderAt('', '999')
    expect((await screen.findAllByText('Không tìm thấy người dùng')).length).toBeGreaterThan(0)
  })
})
