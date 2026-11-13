/**
 * Đánh dấu bài đọc ở thi thử (đợt 2, 10/11/2026 — ca EXAM-204…207). Đang thi: chỉ màu, gạch chân, tẩy,
 * gạch bỏ đáp án (không gắn câu, không ghi chú); lưu theo lượt, riêng với nháp đáp án. Xem lại sau khi
 * nộp: thấy đánh dấu của lượt + bằng chứng + chẩn đoán, sửa được đủ công cụ.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  search: 'examId=7&start=1',
  start: vi.fn(),
  save: vi.fn(),
  result: vi.fn(),
  analysis: vi.fn(),
  getMarks: vi.fn(),
  saveMarks: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  saveWord: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  default: { defaults: {}, get: vi.fn(async () => ({ data: [] })), put: vi.fn(async () => ({ data: {} })) },
  apiMessage: () => 'lỗi',
  httpStatus: () => null,
  isAxiosErr: () => false,
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ push: h.push, replace: h.replace }),
}))
vi.mock('next-intl', async () => {
  const base = (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi')
  const cache = new Map<string, ReturnType<typeof base.useTranslations>>()
  return {
    ...base,
    useTranslations: (ns?: string) => {
      const k = ns ?? ''
      if (!cache.has(k)) cache.set(k, base.useTranslations(ns))
      return cache.get(k)!
    },
  }
})
vi.mock('@/hooks/useTracking', () => ({ useTracking: () => ({ trackFeatureAction: vi.fn() }) }))
vi.mock('@/lib/exam/mockAttemptApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/exam/mockAttemptApi')>()),
  startAttempt: h.start,
  saveAttemptDraft: h.save,
  getAttemptResult: h.result,
  getAttemptAnalysis: h.analysis,
}))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getAttemptMarks: h.getMarks,
  saveAttemptMarks: h.saveMarks,
}))

vi.mock('@/lib/myWordsApi', () => ({ myWordsApi: { save: h.saveWord, remove: vi.fn(), list: vi.fn() } }))

import FullExamRoute from '@/app/v2/student/mock-exam/full/page'
import { fnv1a } from '@/components/exam/marks/marksModel'

const CONTEXT = [
  'Frau Özdemir leitet seit acht Jahren eine Freiwilligenagentur.',
  'Wer zu uns kommt, fragt zuerst',
  'nach dem Zeitaufwand. Ein Projekt über drei Monate finden viele gut.',
].join('\n')
const ITEMS = [
  { id: 'LV2-6', question: 'Frau Özdemir leitet …', options: { a: 'eine Schule.', b: 'eine Agentur.', c: 'einen Verein.' } },
  { id: 'LV2-7', question: 'Wer kommt, fragt zuerst, …', options: { a: 'wie viel Zeit es kostet.', b: 'ob es Geld gibt.', c: 'wer mitmacht.' } },
]
const SECTIONS = JSON.stringify({
  sections: [{ name: 'LESEN', teile: [{ teil: 2, type: 'MULTIPLE_CHOICE', context: CONTEXT, context_lines: true, items: ITEMS }] }],
})
const EVIDENCE = 'fragt zuerst\nnach dem Zeitaufwand'

/** Bôi đen một cụm trong bài đọc như người dùng kéo chuột. */
function selectInPassage(phrase: string) {
  const seg = Array.from(document.querySelectorAll<HTMLElement>('[data-seg][data-b="ctx"]')).find((s) => s.textContent!.includes(phrase))!
  const node = seg.firstChild!
  const at = seg.textContent!.indexOf(phrase)
  const range = document.createRange()
  range.setStart(node, at)
  range.setEnd(node, at + phrase.length)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  fireEvent.pointerUp(document)
}

beforeEach(() => {
  ;[h.start, h.save, h.result, h.analysis, h.getMarks, h.saveMarks, h.push, h.replace, h.saveWord].forEach((f) => f.mockReset())
  h.search = 'examId=7&start=1'
  h.start.mockResolvedValue({
    attemptId: 55, examId: 7, sectionsJson: SECTIONS, remainingSeconds: 3600, answers: {}, sectionIndex: 0,
    draftVersion: 3, flags: [], closedAttemptId: null,
  })
  h.save.mockResolvedValue({ kind: 'saved', version: 4, remainingSeconds: 3600 })
  h.getMarks.mockResolvedValue({ marks: {}, updatedAt: null })
  h.saveMarks.mockImplementation(async (_a: number, _k: string, marks: unknown) => ({ marks, updatedAt: null }))
  // màn rộng ⇒ hai cột, có thanh công cụ đánh dấu
  window.matchMedia = ((q: string) => ({
    matches: q.includes('min-width'), media: q, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  Element.prototype.getClientRects = function () {
    return [{ left: 0, right: 10, top: 100, bottom: 120 }] as unknown as DOMRectList
  }
  Range.prototype.getClientRects = function () {
    return [{ left: 0, right: 10, top: 100, bottom: 120 }] as unknown as DOMRectList
  }
  Range.prototype.getBoundingClientRect = function () {
    return { left: 0, right: 10, top: 100, bottom: 120, width: 10, height: 20, x: 0, y: 100, toJSON: () => ({}) } as DOMRect
  }
  Element.prototype.scrollIntoView = () => undefined
})

describe('Đánh dấu bài đọc — thi thử', () => {
  it('đang thi: chỉ màu + gạch chân, không gắn câu / ghi chú; lưu theo lượt, không đụng nháp (EXAM-204, 206)', async () => {
    const user = userEvent.setup()
    render(<FullExamRoute />)
    await screen.findByText('Bút đánh dấu')
    await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(55, 'LESEN-2'))
    expect(screen.getByText(/Trong giờ thi không gắn số câu hay ghi chú/)).toBeInTheDocument()

    selectInPassage('Zeitaufwand')
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })
    expect(within(toolbar).getByRole('button', { name: 'Gạch chân' })).toBeInTheDocument()
    expect(within(toolbar).queryByRole('button', { name: 'Gắn vào câu' })).toBeNull()
    expect(within(toolbar).queryByRole('button', { name: 'Ghi chú' })).toBeNull()
    expect(within(toolbar).queryByRole('button', { name: /Câu \d/ })).toBeNull()
    // đang thi: không lưu từ (EXAM-237)
    expect(within(toolbar).queryByRole('button', { name: /Lưu vào sổ từ/ })).toBeNull()
    await user.click(within(toolbar).getByRole('button', { name: 'Vàng · từ khoá' }))

    await waitFor(() => expect(h.saveMarks).toHaveBeenCalled(), { timeout: 4000 })
    const [attemptId, teilKey, pack] = h.saveMarks.mock.calls.at(-1)!
    expect([attemptId, teilKey]).toEqual([55, 'LESEN-2'])
    expect((pack as { marks: Array<{ c: string; q: unknown }> }).marks).toEqual([expect.objectContaining({ c: 'y', q: null })])
    // gạch bỏ phương án vẫn có trong giờ thi
    expect(screen.getAllByRole('button', { name: 'Gạch bỏ phương án a' }).length).toBeGreaterThan(0)
    // lưu đánh dấu không gửi nháp đáp án (hai luồng lưu độc lập)
    expect(h.save).not.toHaveBeenCalled()
  }, 10_000)

  it('tô xong chuyển Teil ngay ⇒ lưu luôn vào Teil cũ, không mất trong lúc chờ hẹn giờ', async () => {
    const user = userEvent.setup()
    h.start.mockResolvedValue({
      attemptId: 55, examId: 7, remainingSeconds: 3600, answers: {}, sectionIndex: 0, draftVersion: 3, flags: [], closedAttemptId: null,
      sectionsJson: JSON.stringify({
        sections: [{ name: 'LESEN', teile: [
          { teil: 2, type: 'MULTIPLE_CHOICE', context: CONTEXT, context_lines: true, items: ITEMS },
          { teil: 3, type: 'MULTIPLE_CHOICE', items: [{ id: 'L3-1', question: 'Frage', options: { a: 'eins', b: 'zwei' } }] },
        ] }],
      }),
    })
    render(<FullExamRoute />)
    await screen.findByText('Bút đánh dấu')
    await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(55, 'LESEN-2'))

    selectInPassage('Zeitaufwand')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: 'Hồng · chưa chắc' }))
    expect(h.saveMarks).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Teil sau' }))

    expect(h.saveMarks).toHaveBeenCalledTimes(1)
    expect(h.saveMarks.mock.calls[0][1]).toBe('LESEN-2')
    expect((h.saveMarks.mock.calls[0][2] as { marks: Array<{ c: string }> }).marks).toEqual([expect.objectContaining({ c: 'p' })])
  })

  it('xem lại sau khi nộp: thấy đánh dấu của lượt + chẩn đoán, có đủ công cụ (EXAM-207)', async () => {
    const user = userEvent.setup()
    h.search = 'attemptId=55'
    h.result.mockResolvedValue({ id: 55, exam_id: 7, exam_title: 'Modelltest 1', status: 'COMPLETED', total_score: 5, passed: false, detailed_scores_json: null })
    h.analysis.mockResolvedValue({
      attemptId: 55, examId: 7, sectionsJson: SECTIONS, writingText: null, writing: null,
      teile: [{
        teilKey: 'LESEN-2', type: 'MULTIPLE_CHOICE', score: 0, max: 10, correctCount: 0, total: 2, unusedOptions: [],
        items: [
          { id: 'LV2-6', label: '6', given: 'a', givenText: null, correct: 'b', correctText: 'eine Agentur.', answered: true, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['leitet seit acht Jahren eine Freiwilligenagentur'], need: null, rule: null },
          { id: 'LV2-7', label: '7', given: 'b', givenText: null, correct: 'a', correctText: 'wie viel Zeit es kostet.', answered: true, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['fragt zuerst nach dem Zeitaufwand'], need: null, rule: null },
        ],
      }],
    })
    const s = CONTEXT.indexOf(EVIDENCE)
    h.getMarks.mockResolvedValue({
      updatedAt: null,
      marks: {
        v: 1,
        blocks: { ctx: fnv1a(CONTEXT) },
        marks: [{ id: 'h1', g: 'g1', b: 'ctx', s, e: s + EVIDENCE.length, k: 'hl', c: 'g', q: 'LV2-7', n: 'Zeit' }],
        struck: {},
      },
    })
    render(<FullExamRoute />)

    await user.click(await screen.findByRole('button', { name: /Leseverstehen 2/ }))
    await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(55, 'LESEN-2'))
    expect(await screen.findByRole('button', { name: 'Đã gắn vào câu 7, bấm để mở câu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ghi chú: Zeit' })).toBeInTheDocument()
    expect(screen.getByText(/Bôi đen chữ trong bài hoặc trong câu hỏi/)).toBeInTheDocument()

    // mở câu 7 ⇒ chẩn đoán "đúng chỗ" từ đánh dấu lúc thi
    await user.click(within(document.getElementById('pq-LV2-7')!).getByRole('button', { name: /phân tích/ }))
    expect(await screen.findByText(/Bạn đã đánh dấu đúng chỗ chứa đáp án/)).toBeInTheDocument()

    // sửa được: bôi đen ⇒ thanh công cụ có gắn câu + ghi chú
    selectInPassage('Projekt')
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })
    expect(within(toolbar).getByRole('button', { name: 'Gắn vào câu' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Ghi chú' })).toBeInTheDocument()

    // xem lại: lưu từ theo lượt — server lấy đề từ lượt (EXAM-237)
    h.saveWord.mockResolvedValue({
      id: 9, lemma: 'Projekt', article: 'das', pos: 'NOUN', meaning: 'dự án', topic: 'Beruf', topicLabel: 'Nghề nghiệp',
      surface: 'Projekt', sentence: null, examId: 7, examTitle: 'Modelltest 1', teilKey: 'LESEN-2', block: 'ctx',
      start: 0, end: 7, createdAt: '2026-11-13T10:00:00Z', alreadySaved: false,
    })
    await user.click(within(toolbar).getByRole('button', { name: /Lưu vào sổ từ/ }))
    const at = CONTEXT.indexOf('Projekt')
    expect(h.saveWord).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Projekt', examId: null, attemptId: 55, teilKey: 'LESEN-2', block: 'ctx', start: at, end: at + 7 }),
      'vi',
    )
    expect(await within(await screen.findByTestId('save-word-card')).findByText('Đã lưu vào sổ từ')).toBeInTheDocument()
  }, 10_000)
})
