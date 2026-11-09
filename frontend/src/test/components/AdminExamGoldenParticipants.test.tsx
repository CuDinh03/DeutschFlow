/**
 * Chiến dịch hiệu chuẩn (quyết định owner 26/08: CHỈ lưu audio phiên golden):
 *   1. Danh sách rỗng nói rõ "đang chấm trên bản gỡ băng" — không im lặng.
 *   2. Thêm người đồng ý gọi API đúng payload rồi nạp lại danh sách.
 *   3. Rút đồng ý phải có xác nhận (xoá audio là hành động không hoàn tác được).
 * Catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import AdminExamGoldenPage from '@/app/v2/admin/exam-golden/page'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  compare: vi.fn(),
  listParticipants: vi.fn(),
  addParticipant: vi.fn(),
  removeParticipant: vi.fn(),
}))
vi.mock('@/lib/adminExamGoldenApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  adminExamGoldenApi: mocks,
}))

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...chromeVi } }}>
      <AdminExamGoldenPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSessions.mockResolvedValue({ data: [] })
  mocks.compare.mockResolvedValue({
    data: { sessions: 0, ratedPairs: 0, passAgreePct: null, exactBandPct: null, within1BandPct: null, rows: [] },
  })
  mocks.listParticipants.mockResolvedValue({ data: [] })
  mocks.addParticipant.mockResolvedValue({ data: {} })
  mocks.removeParticipant.mockResolvedValue({ data: { userId: 7, audioDeleted: 3 } })
})

afterEach(() => vi.restoreAllMocks())

describe('Golden set — danh sách đồng ý lưu audio', () => {
  it('rỗng → nói rõ đang chấm trên bản gỡ băng', async () => {
    renderPage()
    await waitFor(() => expect(mocks.listParticipants).toHaveBeenCalled())
    expect((await screen.findByTestId('participants-empty')).textContent).toContain('bản gỡ băng')
  })

  it('thêm người đồng ý → gọi API đúng id + ghi chú, rồi nạp lại danh sách', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(mocks.listParticipants).toHaveBeenCalledTimes(1))

    await user.type(screen.getByTestId('participant-user-id'), '42')
    await user.type(screen.getByTestId('participant-note'), 'ký giấy 26/08')
    await user.click(screen.getByTestId('participant-add'))

    await waitFor(() =>
      expect(mocks.addParticipant).toHaveBeenCalledWith({ userId: 42, note: 'ký giấy 26/08' }),
    )
    await waitFor(() => expect(mocks.listParticipants).toHaveBeenCalledTimes(2))
  })

  it('rút đồng ý phải xác nhận; huỷ xác nhận thì KHÔNG gọi API xoá', async () => {
    mocks.listParticipants.mockResolvedValue({
      data: [{ userId: 7, displayName: 'Cu', email: 'cu@test', consentedAt: '2026-08-20T09:00:00Z', note: null }],
    })
    const user = userEvent.setup()
    renderPage()

    const list = await screen.findByTestId('participants-list')
    expect(list.textContent).toContain('Cu')

    // 09/11/2026: hộp ConfirmDialog thay window.confirm — nêu đúng tên người bị rút đồng ý.
    await user.click(within_(list))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Rút đồng ý của Cu?')
    await user.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(mocks.removeParticipant).not.toHaveBeenCalled()
  })

  it('xác nhận trong hộp thoại mới gọi API xoá đúng người', async () => {
    mocks.listParticipants.mockResolvedValue({
      data: [{ userId: 7, displayName: 'Cu', email: 'cu@test', consentedAt: '2026-08-20T09:00:00Z', note: null }],
    })
    mocks.removeParticipant.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()

    const list = await screen.findByTestId('participants-list')
    await user.click(within_(list))
    const dialog = await screen.findByRole('dialog')
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.getAttribute('data-tone') === 'danger')
    expect(confirmBtn).toBeTruthy()
    await user.click(confirmBtn as HTMLElement)
    await waitFor(() => expect(mocks.removeParticipant).toHaveBeenCalledWith(7))
  })
})

/** Nút rút đồng ý là nút duy nhất trong hàng người tham gia. */
function within_(list: HTMLElement): HTMLElement {
  const btn = list.querySelector('button')
  if (!btn) throw new Error('không tìm thấy nút rút đồng ý')
  return btn as HTMLElement
}
