/**
 * Audit F-M7 (03/09/2026) — trang cấu hình AI từng nuốt lỗi tải.
 *
 * `useAdminData` trả về `error`, nhưng trang KHÔNG destructure nó. Khi GET /admin/ai-config lỗi,
 * hook giữ nguyên `initialData` = DEFAULT_CONFIG (prompt rỗng) và cho `loading` về false, nên
 * editable state bị nạp prompt RỖNG mà màn hình không báo gì. Bấm Lưu một cái là system prompt
 * production bị ghi đè bằng chuỗi rỗng — mọi lời gọi AI của hệ thống mất prompt nền.
 *
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import AiConfigPage from '@/app/v2/admin/ai-config/page'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    default: { get: mocks.get, put: mocks.put },
    apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'lỗi'),
    httpStatus: () => 500,
  }
})
// Router PHẢI là một object cố định: useAdminData ghi nhớ `reload` theo `router`, nên một object
// mới mỗi lần render sẽ tái tạo effect và bắn reload vô hạn (đúng bẫy đã gặp khi viết bài này).
const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }}>
      <AiConfigPage />
    </NextIntlClientProvider>,
  )
}

const saveButton = () => screen.getByRole('button', { name: /lưu cấu hình|đang lưu/i })

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('Trang cấu hình AI — hàng rào chống ghi đè prompt', () => {
  it('tải LỖI → hiện cảnh báo, nút Lưu bị vô hiệu, không PUT nào được gửi', async () => {
    mocks.get.mockImplementation((url: string) =>
      url === '/auth/me'
        ? Promise.resolve({ data: { role: 'ADMIN' } })
        : Promise.reject(new Error('backend sập')),
    )

    renderPage()

    await screen.findByRole('alert')
    expect(saveButton()).toBeDisabled()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('tải THÀNH CÔNG → không cảnh báo, nút Lưu bật lại, prompt thật hiển thị', async () => {
    mocks.get.mockImplementation((url: string) =>
      url === '/auth/me'
        ? Promise.resolve({ data: { role: 'ADMIN' } })
        : Promise.resolve({
            data: { prompt: 'Bạn là trợ lý tiếng Đức.', temperature: 0.7, maxTokens: 1024, topP: 0.9 },
          }),
    )

    renderPage()

    // Trang nạp prompt vào form bằng một effect chạy SAU lượt render đã bật nút Lưu (loaded=true),
    // nên "nút bật" và "prompt hiện" là HAI commit. Chờ nút rồi đọc textarea liền là đua với
    // scheduler của React (trượt khi lượt render đầu vượt lát cắt 5ms — runner chậm). Chờ trạng thái
    // đích là prompt thật; khi nó đã hiện thì nút Lưu chắc chắn đã bật từ commit trước.
    expect(await screen.findByDisplayValue('Bạn là trợ lý tiếng Đức.')).toBeTruthy()
    expect(saveButton()).not.toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
