import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import authVi from '../../../messages/v2/auth.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'

/**
 * Đăng nhập + 2FA ADMIN (09/11/2026). Điều khoá lại:
 *   1. /auth/login trả THỬ THÁCH → KHÔNG setTokens, trang chuyển sang bước 2FA;
 *   2. đã đăng ký: mã 6 số (hoặc mã khôi phục) → /auth/mfa/verify → phần đuôi đăng nhập chung;
 *   3. chưa đăng ký: mã email → QR + khoá nhập tay → mã đầu tiên → 10 mã khôi phục, phải tick "đã lưu";
 *   4. lỗi có câu riêng; token thử thách hết hạn ⇒ có lối "Đăng nhập lại" về ô mật khẩu;
 *   5. người dùng thường không đổi gì.
 */

const routerMock = { replace: vi.fn(), push: vi.fn() }
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  recordTokenRefresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { post: mocks.post, get: mocks.get } }
})
vi.mock('@/lib/authSession', () => ({
  setTokens: mocks.setTokens,
  clearTokens: mocks.clearTokens,
  recordTokenRefresh: mocks.recordTokenRefresh,
}))
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackEvent: vi.fn(), identifyUser: vi.fn() }) }))
vi.mock('@/hooks/usePushNotifications', () => ({ registerPushNotifications: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') } }))

import V2LoginPage from '@/app/v2/login/page'

const ADMIN_SESSION = {
  accessToken: 'ACCESS-MFA',
  userId: 1,
  email: 'owner@x.com',
  role: 'ADMIN',
  locale: 'vi',
  orgId: null,
  orgRole: null,
}
const CODES = Array.from({ length: 10 }, (_, i) => `AAAA${i}-BBBBB`)

function challenge(enrolled: boolean) {
  return { data: { mfaRequired: true, mfaToken: 'mfa-1', enrolled, emailHint: 'o***@x.com' } }
}

function axiosError(status: number, code?: string) {
  return {
    isAxiosError: true,
    message: 'Request failed',
    response: { status, data: { detail: 'x', ...(code ? { extensions: { code } } : {}) }, headers: {} },
  }
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...authVi, ...chromeVi } }}>
      <V2LoginPage />
    </NextIntlClientProvider>,
  )
}

async function submitPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Email/), 'owner@x.com')
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'MatKhau123!')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockImplementation((url: string) =>
    url === '/auth/me'
      ? Promise.resolve({ data: { userId: 1, email: 'owner@x.com', role: 'ADMIN', displayName: 'Owner' } })
      : Promise.resolve({ data: {} }),
  )
})

describe('/v2/login — 2FA ADMIN', () => {
  it('thử thách 2FA: KHÔNG setTokens, chuyển sang bước nhập mã', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true))
    renderPage()
    await submitPassword(user)

    expect(await screen.findByText('Nhập mã xác thực')).toBeTruthy()
    expect(mocks.setTokens).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalledWith('/auth/me')
  })

  it('đã đăng ký: mã 6 số → /auth/mfa/verify → lưu phiên + vào trang', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true)).mockResolvedValueOnce({ data: ADMIN_SESSION })
    renderPage()
    await submitPassword(user)

    await user.type(await screen.findByLabelText('Mã 6 số'), '123456')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/mfa/verify', { mfaToken: 'mfa-1', code: '123456' }))
    await waitFor(() => expect(mocks.setTokens).toHaveBeenCalledWith(ADMIN_SESSION))
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())
  })

  it('"Dùng mã khôi phục" gửi recoveryCode thay vì code', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true)).mockResolvedValueOnce({ data: ADMIN_SESSION })
    renderPage()
    await submitPassword(user)

    await user.click(await screen.findByRole('button', { name: 'Dùng mã khôi phục' }))
    await user.type(screen.getByLabelText(/Mã khôi phục/), 'ABCDE-FGHIJ')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/auth/mfa/verify', { mfaToken: 'mfa-1', recoveryCode: 'ABCDE-FGHIJ' }))
  })

  it('mã sai → câu "Mã không đúng…", chưa lưu phiên', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true)).mockRejectedValueOnce(axiosError(400, 'MFA_CODE_INVALID'))
    renderPage()
    await submitPassword(user)

    await user.type(await screen.findByLabelText('Mã 6 số'), '000000')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    expect(await screen.findByText('Mã không đúng hoặc đã hết hạn.')).toBeTruthy()
    expect(mocks.setTokens).not.toHaveBeenCalled()
  })

  it('quá số lần sai (429) → câu chờ 15 phút', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true)).mockRejectedValueOnce(axiosError(429, 'RATE_LIMITED'))
    renderPage()
    await submitPassword(user)

    await user.type(await screen.findByLabelText('Mã 6 số'), '000000')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    expect(await screen.findByText(/thử lại sau 15 phút/)).toBeTruthy()
  })

  it('token thử thách hết hạn → câu riêng + "Đăng nhập lại" quay về ô mật khẩu', async () => {
    const user = userEvent.setup()
    mocks.post.mockResolvedValueOnce(challenge(true)).mockRejectedValueOnce(axiosError(400, 'MFA_TOKEN_INVALID'))
    renderPage()
    await submitPassword(user)

    await user.type(await screen.findByLabelText('Mã 6 số'), '123456')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    expect(await screen.findByText('Phiên xác thực đã hết hạn.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Đăng nhập lại' }))
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy()
    expect(screen.queryByTestId('mfa-step')).toBeNull()
  })

  it('máy chủ thiếu khoá 2FA (503 MFA_NOT_CONFIGURED ở bước mật khẩu) → câu dịch sẵn', async () => {
    const user = userEvent.setup()
    mocks.post.mockRejectedValueOnce(axiosError(503, 'MFA_NOT_CONFIGURED'))
    renderPage()
    await submitPassword(user)

    expect(await screen.findByText(/chưa cấu hình xác thực hai lớp/)).toBeTruthy()
  })

  it('chưa đăng ký: mã email → QR + khoá → mã đầu tiên → 10 mã khôi phục, phải tick "đã lưu" mới vào', async () => {
    const user = userEvent.setup()
    mocks.post
      .mockResolvedValueOnce(challenge(false))
      .mockResolvedValueOnce({ data: { emailHint: 'o***@x.com', expiresInSeconds: 600 } })
      .mockResolvedValueOnce({
        data: {
          otpauthUri: 'otpauth://totp/DeutschFlow:owner%40x.com?secret=JBSWY3DPEHPK3PXP&issuer=DeutschFlow',
          secretBase32: 'JBSWY3DPEHPK3PXP',
          mfaToken: 'mfa-2',
        },
      })
      .mockResolvedValueOnce({ data: { recoveryCodes: CODES, session: ADMIN_SESSION } })
    renderPage()
    await submitPassword(user)

    expect(await screen.findByText('Bật xác thực hai lớp')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Gửi mã qua email' }))
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/mfa/email-code', { mfaToken: 'mfa-1' }))

    await user.type(await screen.findByLabelText('Mã trong email'), '654321')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/auth/mfa/enroll/start', { mfaToken: 'mfa-1', emailCode: '654321' }))

    const qr = (await screen.findByTestId('mfa-qr')) as HTMLImageElement
    expect(qr.src).toContain('data:image/png;base64,QR')
    expect(screen.getByTestId('mfa-secret').textContent).toBe('JBSWY3DPEHPK3PXP')

    await user.type(screen.getByLabelText('Mã 6 số'), '112233')
    await user.click(screen.getByRole('button', { name: 'Bật xác thực hai lớp' }))
    // Token MỚI từ enroll/start được dùng cho bước xác nhận.
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/auth/mfa/enroll/confirm', { mfaToken: 'mfa-2', code: '112233' }))

    expect(await screen.findAllByTestId('recovery-code')).toHaveLength(10)
    expect(mocks.setTokens).not.toHaveBeenCalled()
    const go = screen.getByRole('button', { name: 'Tiếp tục vào trang' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    await user.click(screen.getByLabelText('Tôi đã lưu các mã này ở nơi an toàn'))
    expect(go.disabled).toBe(false)
    await user.click(go)

    await waitFor(() => expect(mocks.setTokens).toHaveBeenCalledWith(ADMIN_SESSION))
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())
  })

  it('người dùng thường: đăng nhập y như cũ (setTokens ngay, không bước 2FA)', async () => {
    const user = userEvent.setup()
    const student = { ...ADMIN_SESSION, role: 'STUDENT', accessToken: 'ACCESS' }
    mocks.post.mockResolvedValueOnce({ data: student })
    mocks.get.mockImplementation((url: string) =>
      url === '/auth/me'
        ? Promise.resolve({ data: { userId: 2, email: 'hv@x.com', role: 'STUDENT', displayName: 'HV' } })
        : Promise.resolve({ data: { hasPlan: true } }),
    )
    renderPage()
    await submitPassword(user)

    await waitFor(() => expect(mocks.setTokens).toHaveBeenCalledWith(student))
    expect(screen.queryByTestId('mfa-step')).toBeNull()
  })
})
