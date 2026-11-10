/**
 * Xưởng đề đợt 4 — telc A2, render với catalog vi THẬT: form tạo mới theo cấp, bước Câu hỏi richtig/falsch và form,
 * xem trước Schreiben 2, ghép từ khung (bắt buộc đủ ô).
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { CreateDraftModal } from '@/components/admin/exam-studio/CreateDraftModal'
import { StepItems } from '@/components/admin/exam-studio/StepItems'
import { TeilPreview } from '@/components/admin/exam-studio/TeilPreview'
import { BlueprintAssembleForm } from '@/components/admin/exam-studio/BlueprintAssembleForm'
import type { StudioDraft, StudioItem } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({
  createDraft: vi.fn(), patchDraft: vi.fn(), listBlueprints: vi.fn(), listAssemblySlots: vi.fn(), assembleFromBlueprint: vi.fn(), getBlock: vi.fn(),
}))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (ui: React.ReactElement) =>
  render(<NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }}>{ui}</NextIntlClientProvider>)

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()) })

function item(over: Partial<StudioItem>): StudioItem {
  return {
    id: 'X', question: 'q', options: {}, correct: 'a', explanationVi: '', evidence: '', traps: [], difficultyTarget: 'EASY',
    difficultyMeasured: null, locked: false, light: 'GREEN', flags: [], meta: null, ...over,
  } as StudioItem
}

function draft(over: Partial<StudioDraft>): StudioDraft {
  return {
    id: 4, examFormat: 'TELC', cefrLevel: 'A2', section: 'LESEN', teil: 2, teilType: 'TRUE_FALSE', theme: null, mode: 'EXAM',
    itemCount: 5, difficultyPlan: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, step: 'ITEMS', status: 'DRAFT', busyOp: null,
    lastError: null, sources: [], text: { titleDe: 'Wien', vorspannDe: '', context: 'Liebe Mia', glossary: [] }, textMetrics: null,
    items: [], checks: [], checklistSuggestions: {}, reviewChecklist: {}, quelle: null, blockId: null, createdAt: '', updatedAt: '',
    situation: null, needsSources: false, warnings: [], ...over,
  } as StudioDraft
}

describe('CreateDraftModal — cấp A2', () => {
  it('A2: Hören "Đợt sau", Schreiben Teil 2 ẩn ma trận và gửi cefrLevel A2', async () => {
    m.createDraft.mockResolvedValue(draft({}))
    wrap(<CreateDraftModal open onOpenChange={vi.fn()} onCreated={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Cấp'), 'A2')
    expect(screen.queryByRole('option', { name: /Sprachbausteine/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Nghe \(Hören\) — Đợt sau/ })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Phần'), 'SCHREIBEN')
    await userEvent.selectOptions(screen.getByLabelText('Teil'), '2')
    expect(screen.queryByText('Ma trận độ khó')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }))
    await waitFor(() => expect(m.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      cefrLevel: 'A2', section: 'SCHREIBEN', teil: 2, difficultyPlan: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 },
    })))
  })
})

describe('StepItems — A2', () => {
  it('TRUE_FALSE: đếm richtig/falsch (vàng khi lệch), bấm falsch lưu câu', async () => {
    const items = ['richtig', 'richtig', 'richtig', 'richtig', 'falsch'].map((c, i) =>
      item({ id: `LV2-${6 + i}`, question: `Aussage ${i}`, options: { richtig: 'richtig', falsch: 'falsch' } as StudioItem['options'], correct: c as StudioItem['correct'] }))
    m.patchDraft.mockResolvedValue(draft({ items }))
    const run = vi.fn(async (fn: () => Promise<StudioDraft>) => { await fn(); return true })
    wrap(<StepItems draft={draft({ items })} locked={false} run={run} onNext={vi.fn()} />)
    expect(screen.getByText('richtig 4 · falsch 1')).toBeInTheDocument()
    expect(screen.getByText(/2–3 câu mỗi loại/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'falsch' })[0])
    const sent = m.patchDraft.mock.calls[0][1].items as StudioItem[]
    expect(sent[0].correct).toBe('falsch')
  })

  it('FILL_FORM: xem trước form có đáp án + cách viết khác; thẻ ô ghi đáp án và cảnh báo ô có số', () => {
    const items = [
      item({ id: 'SA1-1', question: 'Tag', correct: 'Montag' as StudioItem['correct'], meta: { accept: 'Mo' } }),
      item({ id: 'SA1-2', question: 'Telefon', correct: '0316 4455' as StudioItem['correct'] }),
    ]
    wrap(<StepItems draft={draft({ section: 'SCHREIBEN', teil: 1, teilType: 'FILL_FORM', items,
      text: { titleDe: 'Anmeldung', vorspannDe: '', context: 'Anna kommt am Montag.', glossary: [] } })} locked={false} run={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Form như học viên thấy (kèm đáp án)')).toBeInTheDocument()
    expect(screen.getByText('cũng được: Mo')).toBeInTheDocument()
    expect(screen.getByText('Đáp án: 0316 4455')).toBeInTheDocument()
    expect(screen.getByText('Ô có số: phải đúng tuyệt đối.')).toBeInTheDocument()
  })
})

describe('TeilPreview — Schreiben A2 Teil 2', () => {
  it('tình huống + "Chọn 3 trong 4 ý"', () => {
    wrap(<TeilPreview layout="WRITE_NOTE" items={[]} text={{ titleDe: '', vorspannDe: '', context: '', glossary: [],
      stimulus: { type: 'SITUATION', from: '', subject: '', body: 'Sie sind krank.' }, writingPoints: ['A', 'B', 'C', 'D'] }} />)
    expect(screen.getByText('Sie sind krank.')).toBeInTheDocument()
    expect(screen.getByText('Chọn 3 trong 4 ý, khoảng 40 từ')).toBeInTheDocument()
    expect(screen.queryByText('Von:')).not.toBeInTheDocument()
  })
})

describe('BlueprintAssembleForm', () => {
  it('nút Ghép chỉ bật khi chọn đủ mọi ô; gửi assembleFromBlueprint', async () => {
    m.listBlueprints.mockResolvedValue([{
      examFormat: 'TELC', cefrLevel: 'A2', title: 'telc Deutsch A2 Lesen–Schreiben', descriptionVi: 'Đọc–Viết.',
      timeLimitMinutes: 50, totalPoints: 30, passPoints: 18,
      sections: [{ name: 'LESEN', labelVi: 'Đọc', timeMinutes: 50, maxPoints: 15, slots: [
        { section: 'LESEN', teil: 1, type: 'MULTIPLE_CHOICE' }, { section: 'LESEN', teil: 2, type: 'TRUE_FALSE' },
      ] }],
    }])
    const opt = (id: number) => ({ id, titleDe: `T${id}`, theme: null, difficultyCounts: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, exposureCount: 0, usedIn: [] })
    m.listAssemblySlots.mockResolvedValue([
      { section: 'LESEN', teil: 1, type: 'MULTIPLE_CHOICE', blocks: [opt(1)] },
      { section: 'LESEN', teil: 2, type: 'TRUE_FALSE', blocks: [opt(2)] },
    ])
    m.assembleFromBlueprint.mockResolvedValue({})
    const onAssembled = vi.fn(async () => undefined)
    wrap(<BlueprintAssembleForm exams={[]} onAssembled={onAssembled} />)
    await waitFor(() => expect(m.listAssemblySlots).toHaveBeenCalledWith('TELC', 'A2'))
    expect(await screen.findByText(/30 điểm, đỗ từ 18, 50 phút/)).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Ghép' })
    expect(btn).toBeDisabled()
    await userEvent.selectOptions(await screen.findByLabelText('Lesen T1'), '1')
    expect(btn).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Lesen T2'), '2')
    expect(btn).toBeEnabled()
    await userEvent.click(btn)
    await waitFor(() => expect(m.assembleFromBlueprint).toHaveBeenCalledWith({
      examFormat: 'TELC', cefrLevel: 'A2', title: 'telc Deutsch A2 Lesen–Schreiben — Bộ đề ghép 1',
      replacements: [{ section: 'LESEN', teil: 1, blockId: 1 }, { section: 'LESEN', teil: 2, blockId: 2 }],
    }))
    expect(onAssembled).toHaveBeenCalled()
  })
})
