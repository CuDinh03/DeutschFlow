import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import orgVi from '../../../messages/v2/org.vi.json'
import authVi from '../../../messages/v2/auth.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'

/**
 * QLT-20 (A1 09/11/2026): /v2/org/accept đọc `?token=` vào state rồi xoá khỏi thanh địa chỉ/lịch sử
 * NGAY lúc mount — không đợi nhận lời mời thành công; tải lại trang dựa vào sessionStorage; xong thì xoá.
 */

const TOKEN_KEY = 'df.orgInviteToken'
const routerMock = { replace: vi.fn(), push: vi.fn() }
const previewMock = vi.fn()
const acceptMock = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/lib/orgApi', () => ({
  previewInvitation: (...a: unknown[]) => previewMock(...a),
  acceptInvitation: (...a: unknown[]) => acceptMock(...a),
}))
vi.mock('@/lib/api', () => ({ apiMessage: () => undefined }))
vi.mock('@/lib/authSession', () => ({ setTokens: vi.fn(), clearTokens: vi.fn(), recordTokenRefresh: vi.fn() }))

import OrgAcceptClientPage from '@/app/v2/(public)/org/accept/client-page'

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...orgVi, ...authVi, ...chromeVi } }}>
      <OrgAcceptClientPage />
    </NextIntlClientProvider>,
  )
}

const validPreview = { orgName: 'TT Sao Mai', role: 'STUDENT', email: 'hv@tt.vn', expired: false }

beforeEach(() => {
  routerMock.replace.mockReset()
  previewMock.mockReset()
  acceptMock.mockReset()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/v2/org/accept?token=inv-tok')
})

describe('/v2/org/accept — token một lần (QLT-20)', () => {
  it('xoá token khỏi URL ngay lúc mount, TRƯỚC khi API xem trước trả lời', async () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    previewMock.mockReturnValue(new Promise(() => {}))
    renderPage()

    await waitFor(() => expect(previewMock).toHaveBeenCalledWith('inv-tok'))
    expect(replaceSpy).toHaveBeenCalled()
    expect(replaceSpy.mock.invocationCallOrder[0]).toBeLessThan(previewMock.mock.invocationCallOrder[0])
    expect(window.location.href).not.toContain('inv-tok')
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('inv-tok')
    replaceSpy.mockRestore()
  })

  it('tải lại trang ⇒ lấy token từ sessionStorage; nhận lời mời xong thì xoá', async () => {
    window.history.replaceState(null, '', '/v2/org/accept')
    window.sessionStorage.setItem(TOKEN_KEY, 'inv-tok')
    previewMock.mockResolvedValue(validPreview)
    acceptMock.mockResolvedValue({
      accessToken: 'a', userId: 1, email: 'hv@tt.vn', role: 'STUDENT', displayName: 'HV', orgId: 2, orgRole: 'STUDENT',
    })
    renderPage()

    await screen.findByText('TT Sao Mai')
    expect(previewMock).toHaveBeenCalledWith('inv-tok')
    await userEvent.type(document.querySelector<HTMLInputElement>('input[name="password"]')!, 'MatKhau123')
    await userEvent.click(screen.getByRole('button', { name: orgVi.org.accept.submit }))

    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('inv-tok', expect.objectContaining({ password: 'MatKhau123' })))
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalled())
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('không có token ở URL lẫn sessionStorage ⇒ báo thiếu token, không gọi API', async () => {
    window.history.replaceState(null, '', '/v2/org/accept')
    renderPage()
    expect(await screen.findByText(orgVi.org.accept.errorMissingToken)).toBeInTheDocument()
    expect(previewMock).not.toHaveBeenCalled()
  })
})
