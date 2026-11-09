/**
 * Đợt 2 admin (09/11/2026) — cấu hình AI: Lưu phải qua hộp xác nhận (caution + lý do), có lịch sử và
 * "Quay lại bản này" (cũng caution + lý do). Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import AiConfigPage from '@/app/v2/admin/ai-config/page'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, put: mocks.put, post: mocks.post },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
    httpStatus: () => 500,
  }
})
// Router cố định — xem AdminAiConfigSaveGuard.test.tsx (useAdminData ghi nhớ reload theo router).
const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

const REASON = 'Giảm nhiệt độ vì câu trả lời quá lan man'
const CONFIG = { prompt: 'Bạn là trợ lý tiếng Đức.', temperature: 0.7, maxTokens: 1024, topP: 0.9 }
const HISTORY = {
  items: [
    {
      id: 7,
      changedAt: '2026-11-09T03:15:00Z',
      changedByUserId: 1,
      changedByEmail: 'ops@x.com',
      reason: 'Thử nhiệt độ thấp hơn cho buổi phỏng vấn',
      before: { prompt: 'Prompt cũ', temperature: 0.9, maxTokens: 1024, topP: 0.9 },
      after: { prompt: 'Prompt mới', temperature: 0.7, maxTokens: 1024, topP: 0.9 },
      restoredFromId: null,
    },
  ],
  total: 1,
  page: 0,
  size: 10,
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }}>
      <AiConfigPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockImplementation((url: string) => {
    if (url === '/auth/me') return Promise.resolve({ data: { role: 'ADMIN' } })
    if (url === '/admin/ai-config/history') return Promise.resolve({ data: HISTORY })
    return Promise.resolve({ data: CONFIG })
  })
  mocks.put.mockResolvedValue({ data: { historyId: 8, changed: ['temperature'] } })
  mocks.post.mockResolvedValue({ data: { historyId: 9, changed: ['temperature'] } })
})
afterEach(() => vi.restoreAllMocks())

describe('Trang cấu hình AI — lý do bắt buộc, lịch sử, quay lại', () => {
  it('Lưu chỉ MỞ hộp xác nhận; PUT gửi kèm lý do sau khi xác nhận', async () => {
    const user = userEvent.setup()
    renderPage()
    const save = await screen.findByRole('button', { name: 'Lưu cấu hình' })
    await waitFor(() => expect(save).not.toBeDisabled())

    await user.click(save)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Lưu cấu hình AI?')).toBeTruthy()
    expect(mocks.put).not.toHaveBeenCalled()

    // Chưa có lý do ⇒ nút xác nhận bị khoá.
    const confirm = within(dialog).getByRole('button', { name: 'Lưu cấu hình' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(confirm)
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith('/admin/ai-config', {
        prompt: CONFIG.prompt,
        temperature: 0.7,
        maxTokens: 1024,
        topP: 0.9,
        reason: REASON,
      }),
    )
  })

  it('lịch sử hiện người sửa, lý do, giá trị đổi; "Quay lại bản này" gọi restore kèm lý do', async () => {
    const user = userEvent.setup()
    renderPage()

    const row = await screen.findByTestId('ai-config-history-item')
    expect(within(row).getByText(/ops@x\.com/)).toBeTruthy()
    expect(within(row).getByText(/Thử nhiệt độ thấp hơn/)).toBeTruthy()
    expect(within(row).getByText('System prompt đã đổi')).toBeTruthy()
    expect(within(row).getByText('Prompt cũ')).toBeTruthy()

    await user.click(within(row).getByRole('button', { name: 'Quay lại bản này' }))
    const dialog = await screen.findByRole('dialog')
    expect(mocks.post).not.toHaveBeenCalled()

    await user.type(within(dialog).getByTestId('confirm-reason'), REASON)
    await user.click(within(dialog).getByRole('button', { name: 'Quay lại bản này' }))
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/admin/ai-config/history/7/restore', { reason: REASON }),
    )
  })
})
