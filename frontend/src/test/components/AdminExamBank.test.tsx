/**
 * Tests cho trang admin ngân hàng đề (Đ5b-A):
 *   1. Ma trận pool tô đúng mức: đỏ khi pool < cardsNeeded (phiên sẽ 409), vàng khi vừa khít.
 *   2. Bảng đề render + đề dùng chung có badge riêng.
 *   3. Editor: JSON hỏng → báo lỗi + khoá nút lưu; khoá partner* lạ → cảnh báo hỏng-âm-thầm + khoá lưu
 *      (guard trùng với backend AiInterlocutorService.KNOWN_PARTNER_KEYS).
 *   4. Sửa đề hợp lệ → gọi update với payload đúng.
 * Catalog vi THẬT (adminOps + student cho StimulusCard) nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import studentVi from '../../../messages/v2/student.vi.json'
import AdminExamBankPage from '@/app/v2/admin/exam-bank/page'
import type { BankPoolCell, BankTaskRow } from '@/lib/adminExamBankApi'

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  tasks: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  blueprints: vi.fn(),
}))
vi.mock('@/lib/adminExamBankApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  adminExamBankApi: mocks,
}))

const CELLS: BankPoolCell[] = [
  { provider: 'GOETHE', level: 'A1', teilNo: 1, archetype: 'SELF_INTRO', title: 'Sich vorstellen', cardsNeeded: 1, poolApproved: 0 },
  { provider: 'GOETHE', level: 'A1', teilNo: 2, archetype: 'CARD_QA', title: 'Fragen', cardsNeeded: 2, poolApproved: 2 },
  { provider: 'TELC', level: 'B1', teilNo: 1, archetype: 'PLAN_NEGOTIATE', title: 'Planen', cardsNeeded: 1, poolApproved: 8 },
]

const ROWS: BankTaskRow[] = [
  {
    id: 41, provider: null, level: 'A1', teilNo: 2, archetype: 'CARD_QA', status: 'APPROVED', source: 'CURATED',
    stimulus: { type: 'THEMENKARTE', thema: 'Essen', wort: 'Obst' },
    createdAt: '2026-08-25T00:00:00Z', updatedAt: '2026-08-25T00:00:00Z',
  },
]

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi, ...studentVi } }}>
      <AdminExamBankPage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.overview.mockResolvedValue({ data: CELLS })
  mocks.blueprints.mockResolvedValue({ data: [] })
  mocks.tasks.mockResolvedValue({ data: ROWS })
  mocks.update.mockResolvedValue({ data: ROWS[0] })
  mocks.create.mockResolvedValue({ data: ROWS[0] })
})

describe('Admin ngân hàng đề', () => {
  it('ma trận pool: đỏ khi thiếu đề (409), vàng khi vừa khít, xanh khi dư', async () => {
    renderPage()
    const red = await screen.findByTestId('pool-GOETHE-A1-1')
    expect(red).toHaveTextContent('0/1 đề')
    expect(red.className).toContain('red')
    expect(screen.getByTestId('pool-GOETHE-A1-2').className).toContain('yellow')
    expect(screen.getByTestId('pool-TELC-B1-1').className).toContain('green')
  })

  it('bảng đề: đề dùng chung có badge, nội dung tóm tắt hiện ra', async () => {
    renderPage()
    const row = await screen.findByTestId('bank-row-41')
    expect(row).toHaveTextContent('Dùng chung')
    expect(row).toHaveTextContent('Essen')
    expect(row).toHaveTextContent('Đang dùng')
  })

  it('editor: JSON hỏng → báo lỗi + khoá lưu; partner* lạ → cảnh báo hỏng-âm-thầm + khoá lưu', async () => {
    renderPage()
    await userEvent.click(await screen.findByTestId('bank-create'))
    const json = await screen.findByTestId('bank-f-json')

    await userEvent.clear(json)
    await userEvent.paste('{không phải json')
    expect(screen.getByTestId('bank-json-invalid')).toBeInTheDocument()
    expect(screen.getByTestId('bank-save')).toBeDisabled()

    await userEvent.clear(json)
    await userEvent.paste('{"type": "PLANNING_CARD", "partnerSchedule": "Mo 10:00"}')
    expect(await screen.findByTestId('bank-partner-unknown')).toHaveTextContent('partnerSchedule')
    expect(screen.getByTestId('bank-save')).toBeDisabled()
  })

  it('sửa đề hợp lệ → PUT với payload đúng rồi tải lại danh sách', async () => {
    renderPage()
    await userEvent.click(await screen.findByTestId('bank-edit-41'))
    const json = await screen.findByTestId('bank-f-json')
    await userEvent.clear(json)
    await userEvent.paste('{"type": "THEMENKARTE", "thema": "Reisen", "partnerStance": "dafür"}')
    await userEvent.selectOptions(screen.getByTestId('bank-f-status'), 'RETIRED')
    await userEvent.click(screen.getByTestId('bank-save'))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    const [id, payload] = mocks.update.mock.calls[0]
    expect(id).toBe(41)
    expect(payload.status).toBe('RETIRED')
    expect(payload.provider).toBeNull()
    expect(payload.stimulus.thema).toBe('Reisen')
  })
})
