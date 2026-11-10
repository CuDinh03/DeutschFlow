/**
 * Hồ sơ → Bảo mật → Xác thực hai lớp (ADMIN, 09/11/2026): trạng thái + số mã khôi phục còn lại; "Tạo mã
 * khôi phục mới" cần mã 6 số hiện tại, 10 mã mới chỉ hiện một lần và phải tick "đã lưu" mới đóng.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import accountVi from '../../../messages/v2/account.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { MfaSection } from '@/app/v2/profile/MfaSection'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { get: mocks.get, post: mocks.post } }
})
vi.mock('sonner', () => ({ toast: Object.assign(() => undefined, { success: vi.fn(), error: vi.fn() }) }))

const CODES = Array.from({ length: 10 }, (_, i) => `CCCC${i}-DDDDD`)

function renderSection() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...accountVi, ...chromeVi } }}>
      <MfaSection />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ data: { enabled: true, enabledAt: '2026-11-09T10:00:00Z', recoveryCodesRemaining: 2 } })
  mocks.post.mockResolvedValue({ data: { recoveryCodes: CODES } })
})

describe('MfaSection', () => {
  it('hiện trạng thái và cảnh báo khi còn < 3 mã', async () => {
    renderSection()
    expect(await screen.findByText(/Còn 2 mã khôi phục chưa dùng/)).toBeTruthy()
    expect(screen.getByText(/Sắp hết/)).toBeTruthy()
    expect(mocks.get).toHaveBeenCalledWith('/profile/me/mfa')
  })

  it('tạo mã mới: cần mã 6 số → POST, hiện 10 mã, phải tick "đã lưu" mới xong', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Tạo mã khôi phục mới' }))
    const submit = screen.getByRole('button', { name: 'Tạo mã khôi phục mới' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    await user.type(screen.getByLabelText('Mã 6 số'), '12a3456')
    expect(submit.disabled).toBe(false)
    await user.click(submit)

    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/profile/me/mfa/recovery-codes', { code: '123456' }))
    expect(await screen.findAllByTestId('recovery-code')).toHaveLength(10)
    const done = screen.getByRole('button', { name: 'Xong' }) as HTMLButtonElement
    expect(done.disabled).toBe(true)
    await user.click(screen.getByLabelText('Tôi đã lưu các mã này ở nơi an toàn'))
    await user.click(done)
    await waitFor(() => expect(screen.queryByTestId('recovery-codes-panel')).toBeNull())
  })

  it('mã sai → câu riêng, không hiện mã', async () => {
    const user = userEvent.setup()
    mocks.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { extensions: { code: 'MFA_CODE_INVALID' } } },
    })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Tạo mã khôi phục mới' }))
    await user.type(screen.getByLabelText('Mã 6 số'), '000000')
    await user.click(screen.getByRole('button', { name: 'Tạo mã khôi phục mới' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mã không đúng hoặc đã dùng')
    expect(screen.queryByTestId('recovery-codes-panel')).toBeNull()
  })
})
