import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import authVi from '../../../messages/v2/auth.vi.json'
// GaAuthShell dựng LanguageToggle, thứ đọc namespace `v2.ui` từ catalog chrome.
import chromeVi from '../../../messages/v2/chrome.vi.json'

/**
 * Màn đặt mật khẩu LẦN ĐẦU (/v2/activate, Q-09 — owner chốt 14/09/2026). Bốn điều khoá lại:
 *   1. hỏi trạng thái liên kết TRƯỚC khi hiện form — không bắt người dùng gõ xong mật khẩu rồi
 *      mới báo "hết hạn";
 *   2. liên kết chết ⇒ KHÔNG có form, nhưng LUÔN có lối thoát sang "Quên mật khẩu" (đường đó vẫn
 *      sống và vẫn đưa các em vào được);
 *   3. mỗi ca chết có câu riêng: hết hạn ≠ đã dùng ≠ không hợp lệ;
 *   4. đặt mật khẩu xong thì về trang đăng nhập — endpoint không cấp phiên.
 * QLT-20 (09/11/2026): token rời thanh địa chỉ/lịch sử NGAY lúc mount (không đợi thành công), tải lại trang
 * thì lấy lại từ sessionStorage, xong thì xoá.
 */

const routerMock = { replace: vi.fn(), push: vi.fn() }
const getMock = vi.fn()
const postMock = vi.fn()
const TOKEN_KEY = 'df.activateToken'

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}))

function openAt(url: string) {
  window.history.replaceState(null, '', url)
}
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => getMock(...a), post: (...a: unknown[]) => postMock(...a) },
}))
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))

import V2ActivatePage from '@/app/v2/activate/page'

const preview = (state: string, over: Record<string, string> = {}) => ({
  data: { state, maskedEmail: 'hoc***@tt.vn', orgName: 'TT Sao Mai', ...over },
})

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...authVi, ...chromeVi } }}>
      <V2ActivatePage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  routerMock.replace.mockReset()
  getMock.mockReset()
  postMock.mockReset()
  window.sessionStorage.clear()
  openAt('/v2/activate?token=tok-abc')
  getMock.mockResolvedValue(preview('VALID'))
  postMock.mockResolvedValue({ data: null })
})

describe('/v2/activate — đặt mật khẩu lần đầu', () => {
  it('hỏi trạng thái liên kết trước, rồi mới hiện form kèm tài khoản đã che', async () => {
    renderPage()

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/auth/activate', { params: { token: 'tok-abc' } }))
    const notice = await screen.findByTestId('activate-account-notice')
    expect(notice.textContent).toContain('hoc***@tt.vn')
    expect(notice.textContent).toContain('TT Sao Mai')
    expect(screen.getByTestId('activate-submit')).toBeInTheDocument()
  })

  it('đặt mật khẩu hợp lệ ⇒ gọi API một lần rồi về trang đăng nhập', async () => {
    renderPage()
    await screen.findByTestId('activate-submit')

    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), 'MatKhauMoi123')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu/i), 'MatKhauMoi123')
    await userEvent.click(screen.getByTestId('activate-submit'))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/auth/activate', { token: 'tok-abc', newPassword: 'MatKhauMoi123' }))
    expect(postMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/v2/login'))
  })

  it('hai mật khẩu không khớp ⇒ báo tại chỗ, KHÔNG gọi API', async () => {
    renderPage()
    await screen.findByTestId('activate-submit')

    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), 'MatKhauMoi123')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu/i), 'MatKhauKhac456')
    await userEvent.click(screen.getByTestId('activate-submit'))

    await waitFor(() => expect(screen.getAllByText(authVi.auth.activate.confirmMismatch).length).toBeGreaterThan(0))
    expect(postMock).not.toHaveBeenCalled()
  })

  it.each([
    ['EXPIRED', authVi.auth.activate.expired],
    ['USED', authVi.auth.activate.used],
    ['UNKNOWN', authVi.auth.activate.unknown],
  ])('liên kết %s ⇒ không có form, có câu riêng và lối thoát sang Quên mật khẩu', async (state, message) => {
    getMock.mockResolvedValue(preview(state, { maskedEmail: '', orgName: '' }))
    renderPage()

    expect(await screen.findByTestId('activate-dead')).toHaveTextContent(message)
    expect(screen.queryByTestId('activate-submit')).not.toBeInTheDocument()
    expect(screen.getByText(authVi.auth.activate.goForgot)).toBeInTheDocument()
  })

  it('URL không có token ⇒ coi như liên kết lạ, KHÔNG gọi API', async () => {
    openAt('/v2/activate')
    renderPage()

    expect(await screen.findByTestId('activate-dead')).toHaveTextContent(authVi.auth.activate.unknown)
    expect(getMock).not.toHaveBeenCalled()
  })

  it('xoá token khỏi URL ngay lúc mount, TRƯỚC khi API trả lời', async () => {
    openAt('/v2/activate?token=tok-abc&utm_source=mail')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    getMock.mockReturnValue(new Promise(() => {})) // API treo: chưa thành công, chưa thất bại
    renderPage()

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/auth/activate', { params: { token: 'tok-abc' } }))
    expect(replaceSpy).toHaveBeenCalled()
    expect(replaceSpy.mock.invocationCallOrder[0]).toBeLessThan(getMock.mock.invocationCallOrder[0])
    expect(window.location.search).toBe('?utm_source=mail')
    expect(window.location.href).not.toContain('tok-abc')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('tok-abc')
    replaceSpy.mockRestore()
  })

  it('tải lại trang (URL đã sạch) ⇒ lấy token từ sessionStorage, đặt xong thì xoá', async () => {
    openAt('/v2/activate')
    window.sessionStorage.setItem(TOKEN_KEY, 'tok-abc')
    renderPage()
    await screen.findByTestId('activate-submit')
    expect(getMock).toHaveBeenCalledWith('/auth/activate', { params: { token: 'tok-abc' } })

    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), 'MatKhauMoi123')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu/i), 'MatKhauMoi123')
    await userEvent.click(screen.getByTestId('activate-submit'))

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/v2/login'))
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('liên kết đã dùng ⇒ không giữ token trong tab', async () => {
    getMock.mockResolvedValue(preview('USED'))
    renderPage()
    await screen.findByTestId('activate-dead')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
