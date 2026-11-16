/**
 * Lỗi tìm thấy khi nghiệm thu góp ý GĐ1 trên prod (17/11/2026):
 *  1. Thông tin kỹ thuật ghi trang cũ (referrer của lần nạp trang đầu) và cỡ màn hình lúc mở form.
 *  2. Số "Góp ý" trên thanh bên admin không giảm khi mở chi tiết (chỉ tải lại khi đổi đường dẫn).
 *  3. Admin mở /v2/feedback thấy "Đã xảy ra lỗi" thay vì lời giải thích (backend trả 403 có chủ đích).
 */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import accountVi from '../../../messages/v2/account.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { NavCount } from '@/components/ui-v2/NavCount'
import { requestNavCountRefresh } from '@/lib/navCountEvents'
import { notePageView } from '@/lib/pageTrail'

const fb = vi.hoisted(() => ({
  submit: vi.fn(),
  form: vi.fn(),
  mine: vi.fn(),
  unreadCount: vi.fn(),
}))
vi.mock('@/lib/feedbackApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feedbackApi')>()
  return {
    ...actual,
    feedbackApi: { ...actual.feedbackApi, submit: fb.submit, form: fb.form, mine: fb.mine },
    adminFeedbackApi: { ...actual.adminFeedbackApi, unreadCount: fb.unreadCount },
  }
})
vi.mock('next/navigation', () => ({ usePathname: () => '/v2/admin/feedback/' }))
vi.mock('@/app/v2/RoleShell', () => ({ RoleShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
const role = vi.hoisted(() => ({ value: 'ADMIN' as string | null }))
vi.mock('@/lib/authSession', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, getKnownAuthRole: () => role.value }
})

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...chromeVi, ...accountVi } }}>
      {node}
    </NextIntlClientProvider>
  )
}

function axios403() {
  return Object.assign(new Error('Forbidden'), {
    isAxiosError: true,
    response: { status: 403, data: { detail: 'Tài khoản quản trị không gửi góp ý. Hãy dùng ghi chú nội bộ.' } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('Thông tin kỹ thuật kèm góp ý', () => {
  it('ghi trang trước trong tab và cỡ màn hình lúc gửi, không phải referrer cũ và cỡ lúc mở form', async () => {
    Object.defineProperty(document, 'referrer', { value: 'https://mydeutschflow.com/v2/admin/feedback/', configurable: true })
    notePageView('/v2/student/dashboard/')
    notePageView('/v2/feedback/')
    window.history.pushState({}, '', '/v2/feedback/')
    Object.assign(window, { innerWidth: 800, innerHeight: 800 })
    fb.submit.mockResolvedValue({ data: { id: 1, status: 'NEW' } })

    render(withIntl(<FeedbackForm audience="STUDENT" onSent={() => {}} />))
    await userEvent.click(screen.getByRole('radio', { name: /Báo lỗi/ }))
    await userEvent.type(screen.getByRole('textbox'), 'Trang bài học bị treo khi bấm nộp.')

    act(() => {
      Object.assign(window, { innerWidth: 390, innerHeight: 844 })
      window.dispatchEvent(new Event('resize'))
    })
    await userEvent.click(screen.getByRole('button', { name: /Gửi góp ý/ }))

    await waitFor(() => expect(fb.submit).toHaveBeenCalledTimes(1))
    const tech = fb.submit.mock.calls[0][0].techInfo
    expect(tech.page).toBe('/v2/student/dashboard/')
    expect(tech.screen).toBe('400x800')
  })
})

describe('Số góp ý chưa đọc trên thanh bên admin', () => {
  it('tải lại khi có yêu cầu làm mới, không chờ đổi đường dẫn', async () => {
    fb.unreadCount.mockResolvedValueOnce({ data: { count: 1 } }).mockResolvedValueOnce({ data: { count: 0 } })
    render(<NavCount countKey="adminFeedbackNew" active={false} />)
    expect(await screen.findByText('1')).toBeInTheDocument()

    act(() => requestNavCountRefresh())

    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument())
    expect(fb.unreadCount).toHaveBeenCalledTimes(2)
  })
})

describe('Admin mở trang Gửi góp ý', () => {
  it('thấy lời giải thích và đường tới hộp góp ý, không thấy "Đã xảy ra lỗi"', async () => {
    role.value = 'ADMIN'
    fb.form.mockRejectedValue(axios403())
    fb.mine.mockRejectedValue(axios403())
    const { default: FeedbackPage } = await import('@/app/v2/feedback/page')

    render(withIntl(<FeedbackPage />))

    expect(await screen.findByText(accountVi.account.feedback.adminBlockedTitle)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: accountVi.account.feedback.adminBlockedCta })).toHaveAttribute('href', '/v2/admin/feedback')
    expect(screen.queryByText(accountVi.account.feedback.mineLoadError)).not.toBeInTheDocument()
  })

  it('người không phải admin bị 403 vẫn thấy báo lỗi tải như cũ', async () => {
    role.value = 'STUDENT'
    fb.form.mockRejectedValue(axios403())
    fb.mine.mockResolvedValue({ data: [] })
    const { default: FeedbackPage } = await import('@/app/v2/feedback/page')

    render(withIntl(<FeedbackPage />))

    expect(await screen.findByText(accountVi.account.feedback.mineLoadError)).toBeInTheDocument()
  })
})
