/**
 * Phiên hỗ trợ chỉ-đọc (V370) trên web:
 *  - hồ sơ người dùng của admin: nút "Xem như người dùng" (ẩn với đích ADMIN / tài khoản khoá), lý do ≥ 15 ký tự,
 *    mở tab mới bằng `noopener,noreferrer` với mã trong fragment;
 *  - trang /v2/support-session: xoá fragment ngay, đổi mã, lưu phiên, về trang chủ của vai trò người dùng;
 *  - banner: đếm ngược mm:ss, hết giờ → trạng thái "đã kết thúc".
 */
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  replace: vi.fn(),
  stopPostHog: vi.fn(),
  startSupportSession: vi.fn(),
  getSupportSession: vi.fn(),
  isSupportMode: vi.fn(() => false),
  markSupportSessionEnded: vi.fn(),
  endSupportSessionFromTab: vi.fn(),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, post: mocks.post },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
  }
})
// Trang đổi mã điều hướng bằng tải lại toàn trang (hardReplace) để PostHog/khác đã khởi động chết theo.
vi.mock('@/lib/hardNavigate', () => ({ hardReplace: mocks.replace }))
vi.mock('@/lib/posthogClient', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, stopPostHogForSupport: mocks.stopPostHog }
})
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => '/v2/support-session/',
}))
vi.mock('@/lib/authSession', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    startSupportSession: mocks.startSupportSession,
    getSupportSession: mocks.getSupportSession,
    isSupportMode: mocks.isSupportMode,
    markSupportSessionEnded: mocks.markSupportSessionEnded,
    endSupportSessionFromTab: mocks.endSupportSessionFromTab,
  }
})

import { SupportViewAction } from '@/app/v2/admin/users/_components/SupportViewAction'
import SupportSessionPage from '@/app/v2/support-session/page'
import { SupportSessionBanner, formatRemaining } from '@/components/ui-v2/SupportSessionBanner'

const messages = { v2: { ...adminOpsVi, ...chromeVi } }
function withIntl(ui: React.ReactElement) {
  return <NextIntlClientProvider locale="vi" messages={messages}>{ui}</NextIntlClientProvider>
}

const REASON = 'Người dùng báo không thấy bài tập tuần này'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isSupportMode.mockReturnValue(false)
  mocks.getSupportSession.mockReturnValue(null)
  mocks.get.mockResolvedValue({ data: { items: [] } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SupportViewAction — hồ sơ người dùng (admin)', () => {
  it('đích ADMIN hoặc tài khoản khoá: không có nút', () => {
    const { rerender } = render(withIntl(<SupportViewAction userId={7} userName="A" role="ADMIN" isActive />))
    expect(screen.queryByTestId('support-view-start')).toBeNull()
    rerender(withIntl(<SupportViewAction userId={7} userName="A" role="STUDENT" isActive={false} />))
    expect(screen.queryByTestId('support-view-start')).toBeNull()
  })

  it('lý do ≥ 15 ký tự → POST rồi window.open(noopener,noreferrer) với mã trong fragment', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    mocks.post.mockResolvedValue({ data: { sessionId: 77, handoffCode: 'abc_DEF-123', expiresAt: '2026-11-09T10:30:00Z' } })
    const user = userEvent.setup()
    render(withIntl(<SupportViewAction userId={9} userName="Học viên A" role="STUDENT" isActive />))

    await user.click(screen.getByRole('button', { name: /Xem như người dùng/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('30 phút · chỉ đọc · người dùng sẽ được thông báo')).toBeTruthy()
    const confirm = within(dialog).getByRole('button', { name: 'Mở tab xem' }) as HTMLButtonElement
    await user.type(within(dialog).getByTestId('confirm-reason'), 'quá ngắn')
    expect(confirm.disabled).toBe(true) // < 15 ký tự
    await user.clear(within(dialog).getByTestId('confirm-reason'))
    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(confirm)

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/users/9/support-session', { reason: REASON }))
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('/v2/support-session#code=abc_DEF-123', '_blank', 'noopener,noreferrer'),
    )
  })

  it('phiên đang mở → hiện "Kết thúc" và gọi POST /admin/support-sessions/{id}/end', async () => {
    mocks.get.mockResolvedValue({
      data: { items: [{ id: 55, active: true, expiresAt: '2026-11-09T10:30:00Z', adminUserId: 1, adminEmail: 'a@x', reason: REASON, startedAt: '', endedAt: null, endReason: null, requestCount: 3 }] },
    })
    mocks.post.mockResolvedValue({ data: { ended: true } })
    const user = userEvent.setup()
    render(withIntl(<SupportViewAction userId={9} userName="Học viên A" role="STUDENT" isActive />))

    await user.click(await screen.findByTestId('support-view-end'))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/admin/support-sessions/55/end'))
  })
})

describe('/v2/support-session — đổi mã', () => {
  it('xoá fragment NGAY, đổi mã (kèm cookie), lưu phiên, về nhà của vai trò người dùng', async () => {
    window.history.replaceState(null, '', '/v2/support-session/#code=HANDOFF123')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    sessionStorage.setItem('accessToken', 'inherited.admin.jwt')
    mocks.post.mockResolvedValue({
      data: {
        accessToken: 'support.jwt',
        session: { id: 77, expiresAt: '2026-11-09T10:30:00Z', targetUserId: 9, role: 'TEACHER', orgId: 3, orgRole: 'MANAGER', targetName: 'GV', targetEmail: 'gv@x' },
      },
    })

    render(withIntl(<SupportSessionPage />))

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/v2/org'))
    expect(replaceState).toHaveBeenCalled()
    expect(window.location.hash).toBe('')
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(mocks.post).toHaveBeenCalledWith('/auth/support-session/redeem', { code: 'HANDOFF123' }, { withCredentials: true })
    expect(mocks.startSupportSession).toHaveBeenCalledWith('support.jwt', expect.objectContaining({ id: 77, role: 'TEACHER', orgRole: 'MANAGER' }))
    expect(mocks.stopPostHog).toHaveBeenCalled()
  })

  it('mã hỏng / hết hạn → thông báo rõ + nút đóng tab, không lưu gì', async () => {
    window.history.replaceState(null, '', '/v2/support-session/#code=BAD')
    mocks.post.mockRejectedValue(new Error('400'))

    render(withIntl(<SupportSessionPage />))

    expect(await screen.findByText('Không mở được phiên hỗ trợ')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đóng tab' })).toBeTruthy()
    expect(mocks.startSupportSession).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

describe('SupportSessionBanner', () => {
  it('ngoài chế độ hỗ trợ: không hiện gì', () => {
    render(withIntl(<SupportSessionBanner />))
    expect(screen.queryByTestId('support-session-banner')).toBeNull()
  })

  it('đếm ngược mm:ss; hết giờ → trạng thái "đã kết thúc" và bỏ token', () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-11-09T10:00:00Z').getTime()
    vi.setSystemTime(t0)
    mocks.getSupportSession.mockReturnValue({
      id: 77, expiresAt: new Date(t0 + 65_000).toISOString(), role: 'STUDENT', orgRole: '', targetName: 'Học viên A', targetEmail: 'hv@x',
    })

    render(withIntl(<SupportSessionBanner />))
    const banner = screen.getByTestId('support-session-banner')
    expect(banner.getAttribute('role')).toBe('status')
    expect(banner.textContent).toContain('Đang xem tài khoản Học viên A (hv@x)')
    expect(banner.textContent).toContain('chỉ đọc')
    expect(banner.textContent).toContain('01:05')

    act(() => {
      vi.advanceTimersByTime(66_000)
    })
    expect(screen.getByTestId('support-session-banner').getAttribute('data-state')).toBe('ended')
    expect(mocks.markSupportSessionEnded).toHaveBeenCalled()
  })

  it('nút Kết thúc gọi endSupportSessionFromTab', async () => {
    mocks.getSupportSession.mockReturnValue({
      id: 77, expiresAt: new Date(Date.now() + 600_000).toISOString(), role: 'STUDENT', orgRole: '', targetName: 'A', targetEmail: 'a@x',
    })
    const user = userEvent.setup()
    render(withIntl(<SupportSessionBanner />))
    await user.click(screen.getByTestId('support-session-end'))
    expect(mocks.endSupportSessionFromTab).toHaveBeenCalled()
  })

  it('formatRemaining', () => {
    expect(formatRemaining(0)).toBe('00:00')
    expect(formatRemaining(-5)).toBe('00:00')
    expect(formatRemaining(29 * 60_000 + 59_999)).toBe('29:59')
  })
})
