/**
 * Tests cho hai error boundary của /v2: `src/app/v2/error.tsx` và `src/app/v2/student/error.tsx`
 * (ruột chung ở `src/app/v2/routeErrorShared.tsx`).
 *
 * Ba điều bắt buộc — đều là thứ boundary gốc `src/app/error.tsx` KHÔNG làm được, tức là lý do hai
 * file kia tồn tại:
 *   1. In ra `error.message` — lỗi client không có `digest`, nên message là manh mối duy nhất mà
 *      người dùng có thể chụp màn hình gửi đi.
 *   2. Nhận ra ChunkLoadError (chunk của bản triển khai cũ) và mời TẢI LẠI thay vì `reset()` — gọi
 *      `reset()` chỉ render lại đúng cây đang hỏng vì tệp thật sự không còn trên máy chủ.
 *   3. Bản của tầng học viên nằm TRONG GaShell nên không được tự dựng `min-h-screen`: `<main>` là
 *      vùng cuộn duy nhất của shell, thêm một chiều cao bằng màn hình là sinh thanh cuộn thứ hai.
 *
 * Provider dùng catalog vi THẬT nên test cũng canh luôn việc thiếu khoá i18n.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import V2Error from '@/app/v2/error'
import V2StudentError from '@/app/v2/student/error'
import V2TeacherError from '@/app/v2/teacher/error'
import V2AdminError from '@/app/v2/admin/error'
import V2OrgError from '@/app/v2/org/error'

const captureMock = vi.fn()
vi.mock('posthog-js', () => ({ default: { __loaded: true, capture: (...a: unknown[]) => captureMock(...a) } }))

type Boundary = typeof V2Error

function renderBoundary(
  Boundary: Boundary,
  error: Error & { digest?: string },
  reset = vi.fn(),
) {
  const { container } = render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...chromeVi } }}>
      <Boundary error={error} reset={reset} />
    </NextIntlClientProvider>,
  )
  return { reset, container }
}

describe('Boundary /v2', () => {
  let consoleErr: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    captureMock.mockClear()
    consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErr.mockRestore()
  })

  it('hiện nguyên nhân thật và mã lỗi thay vì chỉ "có lỗi xảy ra"', () => {
    const error = Object.assign(new Error("Cannot read properties of undefined (reading 'map')"), {
      digest: '3141592653',
    })
    renderBoundary(V2Error, error)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText("Cannot read properties of undefined (reading 'map')"),
    ).toBeInTheDocument()
    expect(screen.getByText(/3141592653/)).toBeInTheDocument()
    expect(screen.getByText('Trang gặp lỗi')).toBeInTheDocument()
  })

  it('nút "Thử lại" gọi reset của Next', async () => {
    const { reset } = renderBoundary(V2Error, new Error('boom'))
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('lỗi chunk cũ → đổi sang lời khuyên tải lại trang', () => {
    const error = Object.assign(new Error('Loading chunk 4837 failed. (missing: /_next/…)'), {
      name: 'ChunkLoadError',
    })
    renderBoundary(V2Error, error)

    expect(screen.getByText('Trình duyệt đang giữ bản cũ')).toBeInTheDocument()
    expect(screen.queryByText('Trang gặp lỗi')).not.toBeInTheDocument()
    // Cả hai nút vẫn có mặt; "Tải lại trang" là nút chính (đứng trước).
    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    expect(buttons).toEqual(['Tải lại trang', 'Thử lại'])
  })

  it('lỗi không có message vẫn ra thẻ đọc được', () => {
    renderBoundary(V2Error, new Error(''))
    expect(screen.getByText('Không có thông báo lỗi.')).toBeInTheDocument()
  })

  it('báo PostHog kèm scope + cờ chunk cũ để lọc được hai nhóm nguyên nhân', () => {
    renderBoundary(V2Error, new Error('boom'))
    expect(captureMock).toHaveBeenCalledWith(
      'client_route_error',
      expect.objectContaining({ scope: 'v2', message: 'boom', staleChunk: false }),
    )
  })
})

/**
 * Bốn boundary theo vai. Chúng phải giống nhau tuyệt đối trừ nhãn `scope` — chạy chung một bảng
 * thay vì viết bốn khối test là cách duy nhất giữ điều đó đúng khi có người thêm vai thứ năm.
 */
const ROLE_BOUNDARIES: [name: string, Boundary: Boundary, scope: string][] = [
  ['student', V2StudentError, 'v2-student'],
  ['teacher', V2TeacherError, 'v2-teacher'],
  ['admin', V2AdminError, 'v2-admin'],
  ['org', V2OrgError, 'v2-org'],
]

describe.each(ROLE_BOUNDARIES)('Boundary /v2/%s', (_name, Boundary, scope) => {
  let consoleErr: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    captureMock.mockClear()
    consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErr.mockRestore()
  })

  it('dùng chung nội dung thẻ với boundary /v2', () => {
    renderBoundary(Boundary, new Error('nổ trong một trang con'))
    expect(screen.getByText('Trang gặp lỗi')).toBeInTheDocument()
    expect(screen.getByText('nổ trong một trang con')).toBeInTheDocument()
  })

  it('lấp đầy vùng nội dung của shell, KHÔNG tự dựng chiều cao bằng màn hình', () => {
    const { container } = renderBoundary(Boundary, new Error('boom'))
    const frame = container.firstElementChild as HTMLElement
    expect(frame.className).toContain('h-full')
    expect(frame.className).not.toContain('min-h-screen')
  })

  it('gắn scope riêng để tách khỏi lỗi tầng /v2', () => {
    renderBoundary(Boundary, new Error('boom'))
    expect(captureMock).toHaveBeenCalledWith(
      'client_route_error',
      expect.objectContaining({ scope }),
    )
  })
})
