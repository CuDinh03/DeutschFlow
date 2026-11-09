/**
 * Đợt 2 admin (09/11/2026) — "Hoạt động bảo mật" trên tab Bảo mật của /v2/profile.
 * GET /profile/me/security-events chỉ trả {event, occurredAt}; web dịch tên vết thành nhãn,
 * hiện thời gian tương đối, trạng thái trống và "Xem thêm" khi còn trang sau.
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import accountVi from '../../../messages/v2/account.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { SecurityActivity } from '@/app/v2/profile/SecurityActivity'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})

function renderIt() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...accountVi, ...chromeVi } }}>
      <SecurityActivity />
    </NextIntlClientProvider>,
  )
}

const now = Date.now()
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('SecurityActivity — hoạt động bảo mật của chính mình', () => {
  it('hiện nhãn theo loại vết + thời gian tương đối; còn trang sau thì có "Xem thêm"', async () => {
    mocks.get.mockImplementation((_url: string, cfg?: { params?: { page?: number } }) =>
      Promise.resolve({
        data:
          cfg?.params?.page === 1
            ? { items: [{ event: 'admin.user.deactivated', occurredAt: iso(3 * 864e5) }], total: 3, page: 1, size: 10 }
            : {
                items: [
                  { event: 'admin.user.password.reset', occurredAt: iso(60_000) },
                  { event: 'user.password.changed', occurredAt: iso(2 * 36e5) },
                ],
                total: 3,
                page: 0,
                size: 10,
              },
      }),
    )
    const user = userEvent.setup()
    renderIt()

    expect(await screen.findByText('Đội hỗ trợ đã đặt lại mật khẩu của bạn')).toBeTruthy()
    expect(screen.getByText('Bạn đã đổi mật khẩu')).toBeTruthy()
    expect(screen.getByText('vừa xong')).toBeTruthy()
    expect(screen.getByText('2 giờ trước')).toBeTruthy()
    expect(mocks.get).toHaveBeenCalledWith('/profile/me/security-events', { params: { page: 0, size: 10 } })

    await user.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(await screen.findByText('Tài khoản bị khoá')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull())
  })

  it('không có vết nào → trạng thái trống, không có "Xem thêm"', async () => {
    mocks.get.mockResolvedValue({ data: { items: [], total: 0, page: 0, size: 10 } })
    renderIt()

    expect(await screen.findByText('Chưa có hoạt động bảo mật nào.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull()
  })

  it('vết lạ (backend thêm trước web) → nhãn chung, không lộ tên kỹ thuật', async () => {
    mocks.get.mockResolvedValue({
      data: { items: [{ event: 'user.passkey.added', occurredAt: iso(60_000) }], total: 1, page: 0, size: 10 },
    })
    renderIt()

    expect(await screen.findByText('Thay đổi bảo mật')).toBeTruthy()
    expect(screen.queryByText('user.passkey.added')).toBeNull()
  })
})
