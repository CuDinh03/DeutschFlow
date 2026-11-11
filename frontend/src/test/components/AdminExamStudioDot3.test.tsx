/**
 * Xưởng đề đợt 3 — render với catalog vi THẬT:
 *   1. Thư có ô (SB1) dựng từ meta, bấm ô gọi onGapClick; chế độ admin hiện đáp án trong ô.
 *   2. Lesen T3 xem trước: tình huống x, mẩu đáp án.
 *   3. Kiểm & duyệt: DUPLICATE đỏ → "Trùng Teil kho #123" + nút xem; Schreiben ghi chú mục SINGLE_ANSWER; warnings.
 *   4. Form tạo mới: Schreiben ẩn ma trận, gửi plan toàn 0 + situation; Hören còn "Đợt sau".
 *   5. Bước Tình huống lưu situation.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { TeilPreview, type PreviewItem } from '@/components/admin/exam-studio/TeilPreview'
import { StepReview } from '@/components/admin/exam-studio/StepReview'
import { StepSituation } from '@/components/admin/exam-studio/StepSituation'
import { CreateDraftModal } from '@/components/admin/exam-studio/CreateDraftModal'
import { StepText } from '@/components/admin/exam-studio/StepText'
import { StepItems } from '@/components/admin/exam-studio/StepItems'
import type { StudioDraft } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ createDraft: vi.fn(), patchDraft: vi.fn(), getBlock: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const messages = { v2: { ...adminContentVi, ...chromeVi } }
const wrap = (ui: React.ReactElement) => render(<NextIntlClientProvider locale="vi" messages={messages}>{ui}</NextIntlClientProvider>)

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()) })

const text = { titleDe: '', vorspannDe: '', glossary: [], context: 'Liebe Anna, ich schreibe dir, weil ich Hilfe brauche.' }

describe('TeilPreview — Sprachbausteine', () => {
  const items: PreviewItem[] = [
    { id: 'SB1-21', question: '', options: { a: 'weil', b: 'denn', c: 'dass' }, correct: 'a', meta: { target: 'weil', before: 'dir,', gap: '21' } },
  ]
  it('dựng ô từ meta; bấm ô gọi onGapClick', async () => {
    const onGap = vi.fn()
    wrap(<TeilPreview layout="GAP_MC" text={text} items={items} showAnswers={false} onGapClick={onGap} />)
    expect(screen.queryByText(/weil, ich/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tới câu của ô 21' }))
    expect(onGap).toHaveBeenCalledWith('SB1-21')
  })
  it('chế độ admin hiện đáp án trong ô', () => {
    wrap(<TeilPreview layout="GAP_MC" text={text} items={items} showAnswers />)
    expect(screen.getByText('21 · a weil')).toBeInTheDocument()
  })
})

describe('TeilPreview — Lesen T3', () => {
  it('tình huống x và mẩu đáp án', () => {
    const ads = Object.fromEntries('abcdefghijkl'.split('').map((k) => [k, `Anzeige ${k}`]))
    wrap(<TeilPreview layout="MATCH_AD_X" text={{ ...text, ads, examples: [{ label: '01', situation: 'Bsp', answer: 'c' }] }}
      items={[
        { id: 'LV3-11', question: 'Situation elf', options: { a: 'Anzeige a' }, correct: 'a' },
        { id: 'LV3-12', question: 'Situation zwölf', options: { b: 'Anzeige b' }, correct: 'x' },
      ]} showAnswers startNumber={11} />)
    expect(screen.getByText('x — không mẩu nào hợp')).toBeInTheDocument()
    expect(screen.getByText('Đáp án của 11')).toBeInTheDocument()
    expect(screen.getByText('Bsp')).toBeInTheDocument()
  })
})

function draft(over: Partial<StudioDraft>): StudioDraft {
  return {
    id: 9, examFormat: 'TELC', cefrLevel: 'B1', section: 'LESEN', teil: 3, teilType: 'MATCH_AD_X', theme: null, mode: 'EXAM',
    itemCount: 10, difficultyPlan: { EASY: 4, MEDIUM: 4, HARD: 2, EXPERT: 0 }, step: 'REVIEW', status: 'DRAFT', busyOp: null,
    lastError: null, sources: [], text: null, textMetrics: null, items: [], checks: [], checklistSuggestions: {},
    reviewChecklist: {}, quelle: null, blockId: null, createdAt: '', updatedAt: '', situation: null, needsSources: false,
    warnings: [], ...over,
  } as StudioDraft
}

describe('StepReview — chống trùng + Schreiben', () => {
  it('DUPLICATE đỏ: nêu Teil kho và mở xem; warnings hiện banner vàng', async () => {
    m.getBlock.mockReturnValue(new Promise(() => undefined))
    wrap(<StepReview locked={false} run={vi.fn()} draft={draft({
      warnings: ['Nguồn này đã dùng ở Teil kho #5'],
      checks: [{ key: 'DUPLICATE', label: 'Không trùng Teil đã có trong kho', light: 'RED', detail: 'Giống 87% Teil kho #123 — đổi chủ đề.' }],
    })} />)
    expect(screen.getByText('Nguồn này đã dùng ở Teil kho #5')).toBeInTheDocument()
    expect(screen.getByText('Trùng Teil kho #123')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Xem Teil kho/ }))
    await waitFor(() => expect(m.getBlock).toHaveBeenCalledWith(123))
  })
  it('Dữ kiện khớp nguồn: máy nêu số câu cần xem thay cho đạt / chưa đạt', () => {
    const { unmount } = wrap(<StepReview locked={false} run={vi.fn()} draft={draft({
      teil: 2, teilType: 'MULTIPLE_CHOICE', checklistSuggestions: { FACTS_MATCH: false },
      checks: [{ key: 'FAITHFUL', label: 'Bài khớp dữ kiện của nguồn', light: 'YELLOW', detail: 'Máy: 2 câu cần xem', count: 2 }],
    })} />)
    expect(screen.getByText('Máy: 2 câu cần xem', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('Máy: chưa đạt')).not.toBeInTheDocument()
    unmount()
    // Bản nháp tự kiểm trước khi có số đếm: giữ nhãn cũ.
    wrap(<StepReview locked={false} run={vi.fn()} draft={draft({
      checklistSuggestions: { FACTS_MATCH: false },
      checks: [{ key: 'FAITHFUL', label: 'Bài khớp dữ kiện đã tích', light: 'YELLOW', detail: 'x' }],
    })} />)
    expect(screen.getByText('Máy: chưa đạt')).toBeInTheDocument()
  })
  it('Schreiben: ghi chú mục "Mỗi câu một đáp án đúng"', () => {
    wrap(<StepReview locked={false} run={vi.fn()} draft={draft({ section: 'SCHREIBEN', teil: 1, teilType: 'WRITE_EMAIL', itemCount: 0 })} />)
    expect(screen.getByText(/Không áp dụng cho Teil viết/)).toBeInTheDocument()
  })
})

describe('CreateDraftModal — Teil theo tình huống', () => {
  it('Schreiben ẩn ma trận, gửi plan 0 + situation; Hören còn Đợt sau', async () => {
    m.createDraft.mockResolvedValue(draft({}))
    wrap(<CreateDraftModal open onOpenChange={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('option', { name: /Nghe \(Hören\) — Đợt sau/ })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Phần'), 'SCHREIBEN')
    expect(screen.queryByText('Ma trận độ khó')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Tình huống'), 'Konzert')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }))
    await waitFor(() => expect(m.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      section: 'SCHREIBEN', teil: 1, situation: 'Konzert', difficultyPlan: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 },
    })))
  })
  it('Lesen Teil 3: ma trận 10 câu (mẫu đề thật 4-4-2-0)', async () => {
    m.createDraft.mockResolvedValue(draft({}))
    wrap(<CreateDraftModal open onOpenChange={vi.fn()} onCreated={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Teil'), '3')
    expect(screen.getByText('Tổng = 10 / 10')).toBeInTheDocument()
  })
})

describe('StepSituation', () => {
  it('lưu situation bằng patchDraft; sang bước sau luôn được', async () => {
    m.patchDraft.mockResolvedValue(draft({ situation: 'Salzburg' }))
    const run = vi.fn(async (fn: () => Promise<StudioDraft>) => { await fn(); return true })
    const onNext = vi.fn()
    wrap(<StepSituation draft={draft({ step: 'SOURCE' })} locked={false} run={run} onNext={onNext} />)
    await userEvent.click(screen.getByRole('button', { name: 'Bước tiếp' }))
    expect(onNext).toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Tình huống'), 'Salzburg')
    await userEvent.click(screen.getByRole('button', { name: /Lưu tình huống/ }))
    expect(m.patchDraft).toHaveBeenCalledWith(9, { situation: 'Salzburg' })
  })
})

describe('StepText / StepItems — Sprachbausteine 2', () => {
  const bank = Object.fromEntries('abcdefghijklmno'.split('').map((k) => [k, `W${k.toUpperCase()}`]))
  const sb2 = draft({
    section: 'SPRACHBAUSTEINE', teil: 2, teilType: 'GAP_WORDBANK', step: 'ITEMS',
    text: { ...text, stimulusAd: 'Sprachkurs in Wien', wordBank: bank },
    items: [{
      id: 'SB2-31', question: 'ich schreibe dir, ___ ich Hilfe brauche.', options: { c: 'WC' }, correct: 'c',
      explanationVi: 'weil + động từ cuối câu', evidence: '', traps: [], difficultyTarget: 'EASY', difficultyMeasured: null,
      locked: false, light: 'GREEN', flags: [], meta: { target: 'weil', before: 'dir,', gap: '31', phenomenon: 'Konnektor' },
    }],
  })

  it('sửa thư rồi lưu: gửi cả object text (giữ wordBank, stimulusAd); cảnh báo GAPS khi đã có câu', async () => {
    m.patchDraft.mockResolvedValue(sb2)
    const run = vi.fn(async (fn: () => Promise<StudioDraft>) => { await fn(); return true })
    wrap(<StepText draft={sb2} locked={false} run={run} onNext={vi.fn()} />)
    expect(screen.getByText(/tự kiểm sẽ báo đỏ GAPS/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Bức thư (nguyên vẹn, chưa đục ô)'), ' Tschüss')
    await userEvent.click(screen.getByRole('button', { name: /Lưu sửa tay/ }))
    const body = m.patchDraft.mock.calls[0][1]
    expect(body.text.wordBank).toEqual(bank)
    expect(body.text.stimulusAd).toBe('Sprachkurs in Wien')
    expect(body.text.context.endsWith('Tschüss')).toBe(true)
  })

  it('bước Câu hỏi: thư có ô, hộp 15 từ với từ đúng của ô 31, thẻ "Ô 31"', () => {
    wrap(<StepItems draft={sb2} locked={false} run={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Hộp 15 từ a–o')).toBeInTheDocument()
    expect(screen.getByText('ô 31')).toBeInTheDocument()
    expect(screen.getAllByText('thừa')).toHaveLength(14)
    expect(screen.getByRole('heading', { name: 'Ô 31' })).toBeInTheDocument()
    expect(screen.getByText('Konnektor')).toBeInTheDocument()
  })
})
