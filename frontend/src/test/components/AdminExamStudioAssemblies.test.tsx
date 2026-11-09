/**
 * Xưởng đề đợt 2 — tab "Bộ đề" với catalog vi THẬT: chọn Teil kho → "Ghép" gọi assembleExam đúng payload;
 * danh sách hiện trạng thái + Teil đã thay; "Phát hành" qua ConfirmDialog.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { AssembliesTab } from '@/components/admin/exam-studio/AssembliesTab'

const m = vi.hoisted(() => ({
  listAssemblyBases: vi.fn(),
  listAssemblySlots: vi.fn(),
  listAssembledExams: vi.fn(),
  assembleExam: vi.fn(),
  publishAssembledExam: vi.fn(),
  retireAssembledExam: vi.fn(),
  getBlock: vi.fn(),
}))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const counts = { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset())
  m.listAssemblyBases.mockResolvedValue([
    { id: 7, title: 'telc B1 Modelltest 1', reviewed: true, slots: [{ section: 'LESEN', teil: 2, type: 'ARTICLE_MC' }] },
  ])
  m.listAssemblySlots.mockResolvedValue([
    { section: 'LESEN', teil: 2, type: 'ARTICLE_MC', blocks: [{ id: 12, titleDe: 'Homeoffice', theme: 'Arbeit', difficultyCounts: counts, exposureCount: 1, usedIn: [] }] },
  ])
  m.listAssembledExams.mockResolvedValue([
    { id: 90, title: 'telc Deutsch B1 — Bộ đề ghép 1', cefrLevel: 'B1', examFormat: 'TELC', reviewed: false, active: true,
      baseExamId: 7, teile: [{ section: 'LESEN', teil: 2, blockId: 12 }], createdAt: '2026-11-09T10:00:00Z' },
  ])
})

function renderTab() {
  render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }}>
      <AssembliesTab active />
    </NextIntlClientProvider>,
  )
}

describe('AssembliesTab', () => {
  it('liệt kê bộ đề đã ghép với đề nền, Teil thay và trạng thái Sắp có', async () => {
    renderTab()
    expect(await screen.findByText('telc Deutsch B1 — Bộ đề ghép 1')).toBeInTheDocument()
    expect(screen.getByText(/Đề nền: telc B1 Modelltest 1/)).toBeInTheDocument()
    expect(screen.getByText('Lesen T2 ← Teil #12')).toBeInTheDocument()
    expect(screen.getAllByText('Sắp có').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Xem như học viên/ })).toHaveAttribute('href', '/v2/student/mock-exam/practice?examId=90')
  })

  it('Ghép chỉ bật khi có Teil thay; gửi đúng payload', async () => {
    m.assembleExam.mockResolvedValue({})
    renderTab()
    const btn = await screen.findByRole('button', { name: 'Ghép' })
    expect(btn).toBeDisabled()
    expect(screen.getByLabelText('Tên bộ đề')).toHaveValue('telc Deutsch B1 — Bộ đề ghép 2')
    await userEvent.selectOptions(screen.getByLabelText('Lesen T2'), '12')
    expect(btn).toBeEnabled()
    await userEvent.click(btn)
    await waitFor(() => expect(m.assembleExam).toHaveBeenCalledWith({
      baseExamId: 7, title: 'telc Deutsch B1 — Bộ đề ghép 2', replacements: [{ section: 'LESEN', teil: 2, blockId: 12 }],
    }))
  })

  it('Phát hành qua hộp xác nhận', async () => {
    m.publishAssembledExam.mockResolvedValue({})
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: /Phát hành/ }))
    expect(screen.getByText(/học viên sẽ thấy/)).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Phát hành' })
    await userEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(m.publishAssembledExam).toHaveBeenCalledWith(90))
  })
})

describe('AssembliesTab — chống trùng giữa bộ đề', () => {
  it('Teil đã trong bộ khác bị khoá; tích "Cho dùng lại" thì chọn được và gửi allowReuse', async () => {
    m.listAssemblySlots.mockResolvedValue([
      { section: 'LESEN', teil: 2, type: 'ARTICLE_MC', blocks: [
        { id: 12, titleDe: 'Homeoffice', theme: 'Arbeit', difficultyCounts: counts, exposureCount: 1, usedIn: [{ id: 90, title: 'Bộ A' }] },
      ] },
    ])
    m.assembleExam.mockResolvedValue({})
    renderTab()
    const opt = await screen.findByRole('option', { name: /Đã trong: Bộ A/ })
    expect(opt).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Cho dùng lại Teil/ }))
    expect(opt).toBeEnabled()
    await userEvent.selectOptions(screen.getByLabelText('Lesen T2'), '12')
    await userEvent.click(screen.getByRole('button', { name: 'Ghép' }))
    await waitFor(() => expect(m.assembleExam).toHaveBeenCalledWith(expect.objectContaining({ allowReuse: true })))
  })
})
