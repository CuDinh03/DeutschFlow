/**
 * Xưởng đề đợt 5 — phần Nghe telc B1, render với catalog vi THẬT:
 *   1. logic: danh mục, số câu đầu, cân richtig/falsch theo tỉ lệ;
 *   2. bước Bài: sửa lời thoại theo lượt, lưu gửi nguyên audioTurns;
 *   3. bước Câu hỏi: thẻ câu richtig/falsch kèm đoạn lời thoại của đúng câu đó;
 *   4. xem trước bản nháp và Teil kho (khuôn phần HOEREN của đề viết tay);
 *   5. ba ngôn ngữ đủ khoá cho các dạng mới.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminContentVi from '../../../messages/v2/adminContent.vi.json'
import adminContentEn from '../../../messages/v2/adminContent.en.json'
import adminContentDe from '../../../messages/v2/adminContent.de.json'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import { StepItems } from '@/components/admin/exam-studio/StepItems'
import { StepText } from '@/components/admin/exam-studio/StepText'
import { TeilPreview } from '@/components/admin/exam-studio/TeilPreview'
import { blockContentToPreview } from '@/components/admin/exam-studio/BlockPreviewModal'
import {
  catalogEntry, firstItemNumber, hoerenSegmentIndex, isHoerenKind, teilKind, trueFalseBalance,
} from '@/lib/examStudioLogic'
import type { StudioDraft, StudioItem, StudioText } from '@/lib/adminExamStudioApi'

const m = vi.hoisted(() => ({ patchDraft: vi.fn(), writeText: vi.fn(), generateItems: vi.fn(), regenerateItem: vi.fn() }))
vi.mock('@/lib/adminExamStudioApi', async (orig) => ({ ...(await orig<object>()), ...m }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (ui: React.ReactElement) =>
  render(<NextIntlClientProvider locale="vi" messages={{ v2: { ...adminContentVi, ...chromeVi } }}>{ui}</NextIntlClientProvider>)

beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()) })

function item(over: Partial<StudioItem>): StudioItem {
  return {
    id: 'HV1-41', question: 'Die Sprecherin isst mittags meistens in der Kantine.', options: { richtig: 'richtig', falsch: 'falsch' },
    correct: 'falsch', explanationVi: '„gehe trotzdem fast nie hin“ ⇒ SAI.', evidence: 'Ich gehe trotzdem fast nie hin.', traps: [],
    difficultyTarget: 'MEDIUM', difficultyMeasured: null, locked: false, light: 'GREEN', flags: [], meta: null, ...over,
  } as StudioItem
}

const T1_TEXT: StudioText = {
  titleDe: '', vorspannDe: '', glossary: [],
  context: 'Dort gibt es eine Kantine. Ich gehe trotzdem fast nie hin.\n\nIch bin Handwerker. Zweimal pro Woche nehme ich Suppe mit.',
  framingDe: 'Was machen die Menschen in ihrer Mittagspause? Wir haben fünf Personen gefragt: „Wie verbringen Sie Ihre Mittagspause?“ Hören Sie dazu die Antworten.',
  audioTurns: [
    { speaker: 'PRUEFER', name: null, text: 'Dort gibt es eine Kantine. Ich gehe trotzdem fast nie hin.', leadInDe: null },
    { speaker: 'PARTNER', name: null, text: 'Ich bin Handwerker. Zweimal pro Woche nehme ich Suppe mit.', leadInDe: null },
  ],
}

function draft(over: Partial<StudioDraft>): StudioDraft {
  return {
    id: 9, examFormat: 'TELC', cefrLevel: 'B1', section: 'HOEREN', teil: 1, teilType: 'HOEREN_STATEMENTS', theme: 'Arbeit', mode: 'EXAM',
    itemCount: 5, difficultyPlan: { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, step: 'ITEMS', status: 'DRAFT', busyOp: null,
    lastError: null, sources: [], text: T1_TEXT, textMetrics: null, items: [], checks: [], checklistSuggestions: {},
    reviewChecklist: {}, quelle: null, blockId: null, createdAt: '', updatedAt: '', situation: null, needsSources: false,
    warnings: [], ...over,
  } as StudioDraft
}

describe('logic phần Nghe', () => {
  it('danh mục B1 có Hören 1–3 soạn theo tình huống; A2 chưa có', () => {
    expect(catalogEntry('HOEREN', 1)).toMatchObject({ teilType: 'HOEREN_STATEMENTS', itemCount: 5, needsSources: false })
    expect(catalogEntry('HOEREN', 2)).toMatchObject({ teilType: 'HOEREN_INTERVIEW', itemCount: 10 })
    expect(catalogEntry('HOEREN', 3)).toMatchObject({ teilType: 'HOEREN_ANNOUNCEMENTS', itemCount: 5 })
    expect(catalogEntry('HOEREN', 1, 'A2')).toBeNull()
    expect(isHoerenKind(teilKind('hoeren_interview'))).toBe(true)
    expect(isHoerenKind(teilKind('TRUE_FALSE'))).toBe(false)
  })
  it('số câu đầu 41 / 46 / 56; câu HV3-58 thuộc đoạn thứ ba', () => {
    expect(firstItemNumber('HOEREN_STATEMENTS', 1)).toBe(41)
    expect(firstItemNumber('HOEREN_INTERVIEW', 2)).toBe(46)
    expect(firstItemNumber('HOEREN_ANNOUNCEMENTS', 3)).toBe(56)
    expect(hoerenSegmentIndex('HV3-58', 56, 0)).toBe(2)
    expect(hoerenSegmentIndex('không-số', 56, 4)).toBe(4)
  })
  it('cân richtig/falsch theo tỉ lệ: 10 câu cần 4–6 mỗi loại', () => {
    const of = (r: number, f: number) => [...Array(r).fill({ correct: 'richtig' }), ...Array(f).fill({ correct: 'falsch' })]
    expect(trueFalseBalance(of(5, 5)).balanced).toBe(true)
    expect(trueFalseBalance(of(6, 4)).balanced).toBe(true)
    expect(trueFalseBalance(of(7, 3)).balanced).toBe(false)
    expect(trueFalseBalance(of(3, 2)).balanced).toBe(true)
    expect(trueFalseBalance(of(5, 0)).balanced).toBe(false)
  })
})

describe('bước Bài — lời thoại', () => {
  it('T1: sửa câu khung và một đoạn, lưu gửi nguyên audioTurns', async () => {
    m.patchDraft.mockResolvedValue(draft({}))
    const run = vi.fn(async (fn: () => Promise<unknown>) => { await fn(); return true })
    wrap(<StepText draft={draft({ step: 'TEXT' })} locked={false} run={run} onNext={vi.fn()} />)
    expect(screen.getByLabelText('Câu khung (đọc trước năm đoạn)')).toHaveValue(T1_TEXT.framingDe)
    expect(screen.getByText('Đoạn 1 · câu 41')).toBeInTheDocument()
    expect(screen.getByText('Đoạn 2 · câu 42')).toBeInTheDocument()
    const second = screen.getByLabelText('Lời thoại đoạn 2')
    await userEvent.type(second, ' Das schmeckt mir.')
    await userEvent.click(screen.getByRole('button', { name: /Lưu/ }))
    await waitFor(() => expect(m.patchDraft).toHaveBeenCalled())
    const body = m.patchDraft.mock.calls[0][1] as { text: StudioText }
    expect(body.text.audioTurns).toHaveLength(2)
    expect(body.text.audioTurns?.[1]).toMatchObject({ speaker: 'PARTNER', text: expect.stringContaining('Das schmeckt mir.') })
    expect(body.text.framingDe).toBe(T1_TEXT.framingDe)
  })

  it('T2: mỗi lượt có tên người nói, thêm lượt mới đổi giọng; T3: có ô câu dẫn tình huống', async () => {
    const interview: StudioText = {
      titleDe: '', vorspannDe: '', context: '', glossary: [],
      audioTurns: [
        { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Guten Tag, Herr Vogel.', leadInDe: null },
        { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Guten Tag.', leadInDe: null },
      ],
    }
    const { unmount } = wrap(<StepText locked={false} run={vi.fn()} onNext={vi.fn()}
      draft={draft({ teil: 2, teilType: 'HOEREN_INTERVIEW', itemCount: 10, text: interview, step: 'TEXT' })} />)
    expect(screen.getByLabelText('Tên người nói của lượt 2')).toHaveValue('Herr Vogel')
    await userEvent.click(screen.getByRole('button', { name: /Thêm lượt lời/ }))
    expect(screen.getByLabelText('Tên người nói của lượt 3')).toHaveValue('Moderatorin')
    unmount()

    const ann: StudioText = {
      titleDe: '', vorspannDe: '', context: '', glossary: [],
      audioTurns: [{ speaker: 'PRUEFER', name: null, text: 'Guten Tag, hier spricht Frau Meyer.', leadInDe: 'Sie hören eine Nachricht auf Ihrem Anrufbeantworter.' }],
    }
    wrap(<StepText locked={false} run={vi.fn()} onNext={vi.fn()}
      draft={draft({ teil: 3, teilType: 'HOEREN_ANNOUNCEMENTS', text: ann, step: 'TEXT' })} />)
    expect(screen.getByLabelText('Câu dẫn tình huống')).toHaveValue('Sie hören eine Nachricht auf Ihrem Anrufbeantworter.')
    // Lời nhắc dưới ô câu dẫn và bản xem trước đều nêu tiền tố máy tự ghép.
    expect(screen.getByText(/Khi vào kho máy tự thêm "Lesen Sie jetzt die Aufgabe 56\."/)).toBeInTheDocument()
    expect(screen.getByText('Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf Ihrem Anrufbeantworter.')).toBeInTheDocument()
  })
})

describe('bước Câu hỏi — richtig/falsch của phần Nghe', () => {
  it('thẻ câu hiện số câu thật, đoạn lời thoại của câu, đổi đáp án bằng một lần bấm', async () => {
    const items = [item({}), item({ id: 'HV1-42', question: 'Der Sprecher nimmt manchmal Suppe mit.', correct: 'richtig' })]
    const run = vi.fn(async (fn: () => Promise<unknown>) => { await fn(); return true })
    m.patchDraft.mockResolvedValue(draft({ items }))
    wrap(<StepItems draft={draft({ items })} locked={false} run={run} onNext={vi.fn()} />)
    expect(screen.getByText('richtig 1 · falsch 1')).toBeInTheDocument()
    const card = document.getElementById('item-card-HV1-42') as HTMLElement
    expect(within(card).getByRole('heading', { name: /42/ })).toBeInTheDocument()
    expect(within(card).getByText(/Zweimal pro Woche nehme ich Suppe mit/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'falsch' }))
    await waitFor(() => expect(m.patchDraft).toHaveBeenCalled())
    const sent = (m.patchDraft.mock.calls[0][1] as { items: StudioItem[] }).items
    expect(sent.find((x) => x.id === 'HV1-42')?.correct).toBe('falsch')
  })

  it('mọi câu cùng một đáp án ⇒ báo đỏ', () => {
    wrap(<StepItems draft={draft({ items: [item({}), item({ id: 'HV1-42' })] })} locked={false} run={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText(/Mọi câu cùng một đáp án/)).toBeInTheDocument()
  })
})

describe('xem trước', () => {
  it('bản nháp T1: câu khung, nhãn giọng, mệnh đề nằm dưới đúng đoạn, đáp án ở chế độ admin', () => {
    wrap(<TeilPreview layout="HOEREN_STATEMENTS" text={T1_TEXT} showAnswers
      items={[item({}), item({ id: 'HV1-42', question: 'Der Sprecher nimmt manchmal Suppe mit.', correct: 'richtig' })]} />)
    expect(screen.getByText(T1_TEXT.framingDe as string)).toBeInTheDocument()
    expect(screen.getByText('Giọng nữ')).toBeInTheDocument()
    expect(screen.getByText('Giọng nam')).toBeInTheDocument()
    const second = screen.getByText(/Ich bin Handwerker/).closest('li') as HTMLElement
    expect(within(second).getByText('42')).toBeInTheDocument()
    expect(within(second).getByText('Der Sprecher nimmt manchmal Suppe mit.')).toBeInTheDocument()
    expect(screen.getByText(/chỉ hiện cho người duyệt/)).toBeInTheDocument()
  })

  it('Teil kho T2: audio_script cấp Teil thành các lượt lời có tên; T3: câu dẫn giữ nguyên, không lặp tiền tố', () => {
    const t2 = blockContentToPreview({
      teil: 2, point_per_item: 2.5, max_plays: 2, reading_seconds: 60, ansage_de: 'Hörverstehen, Teil 2.',
      audio_script: [
        { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Herr Albers, was genau verkaufen Sie?' },
        { speaker: 'PARTNER', name: 'Herr Albers', text: 'Eigentlich alles, was man jeden Tag braucht.' },
      ],
      items: [{ id: 'HV2-46', question: 'Die Kunden bringen eigene Behälter mit.', correct: 'richtig', explanation_vi: 'ĐÚNG.' }],
    })
    expect(t2.layout).toBe('HOEREN_INTERVIEW')
    expect(t2.startNumber).toBe(46)
    expect(t2.text.audioTurns).toEqual([
      { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Herr Albers, was genau verkaufen Sie?', leadInDe: null },
      { speaker: 'PARTNER', name: 'Herr Albers', text: 'Eigentlich alles, was man jeden Tag braucht.', leadInDe: null },
    ])
    expect(t2.items[0]).toMatchObject({ id: 'HV2-46', correct: 'richtig' })

    const t3 = blockContentToPreview({
      teil: 3, max_plays: 2, ansage_de: 'Hörverstehen, Teil 3.',
      items: [{
        id: 'HV3-56', speaker: 'PARTNER', question: 'Die Frau möchte den Termin absagen.', correct: 'falsch',
        lead_in_de: 'Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf dem Anrufbeantworter.',
        audio_script: 'Hallo Frau Brandt, hier ist die Praxis.', explanation_vi: 'SAI.',
      }],
    })
    expect(t3.layout).toBe('HOEREN_ANNOUNCEMENTS')
    wrap(<TeilPreview layout={t3.layout} text={t3.text} items={t3.items} showAnswers />)
    expect(screen.getByText('Lesen Sie jetzt die Aufgabe 56. Sie hören eine Nachricht auf dem Anrufbeantworter.')).toBeInTheDocument()
    expect(screen.getByText('Hallo Frau Brandt, hier ist die Praxis.')).toBeInTheDocument()

    const t1 = blockContentToPreview({
      teil: 1, max_plays: 1, framing_de: 'Wir haben fünf Personen gefragt.',
      items: [{ id: 'HV1-41', speaker: 'PRUEFER', question: 'q', correct: 'richtig', audio_script: 'Nummer 41. Ich fahre Rad.' }],
    })
    expect(t1.layout).toBe('HOEREN_STATEMENTS')
    expect(t1.text.framingDe).toBe('Wir haben fünf Personen gefragt.')
  })
})

describe('catalog', () => {
  it('ba ngôn ngữ có đủ khoá của ba dạng Nghe', () => {
    type Msg = { adminContent: { examStudio: Record<string, Record<string, unknown>> } }
    for (const msg of [adminContentVi, adminContentEn, adminContentDe] as unknown as Msg[]) {
      const es = msg.adminContent.examStudio
      for (const kind of ['HOEREN_STATEMENTS', 'HOEREN_INTERVIEW', 'HOEREN_ANNOUNCEMENTS']) {
        expect((es.frame.blueprintKind as Record<string, string>)[kind]).toBeTruthy()
        expect((es.situation.placeholder as Record<string, string>)[kind]).toBeTruthy()
        expect((es.text.hoerenHint as Record<string, string>)[kind]).toBeTruthy()
      }
      expect(es.preview.hoerenTts).toBeTruthy()
      expect(es.items.hoerenOneSided).toBeTruthy()
    }
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object'
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]
    const text = (msg: unknown) => keys((msg as Msg).adminContent.examStudio.text).sort()
    expect(text(adminContentEn)).toEqual(text(adminContentVi))
    expect(text(adminContentDe)).toEqual(text(adminContentVi))
  })
})
