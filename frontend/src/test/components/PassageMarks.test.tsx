/**
 * Đánh dấu bài đọc ở luyện Teil (09/11/2026, đợt 1 — kế hoạch "đánh dấu bài đọc", ca EXAM-192…201, 209).
 * Bôi đen trong bài ⇒ thanh công cụ ⇒ tô / gắn câu; lưu lên server riêng với nháp đáp án; gạch bỏ
 * phương án; "Làm lại" hỏi có giữ đánh dấu; sau kiểm tra có chẩn đoán "bạn tìm bằng chứng thế nào".
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  check: vi.fn(),
  draft: vi.fn(),
  getMarks: vi.fn(),
  saveMarks: vi.fn(),
  reset: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { seen: ['exam.teil'] } })), put: vi.fn(async () => ({ data: {} })), defaults: {} },
  apiMessage: () => 'lỗi',
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('examId=7&teil=LESEN-2'),
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
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
vi.mock('@/components/exam/strategy/examStrategy', async (orig) => ({
  ...(await orig<typeof import('@/components/exam/strategy/examStrategy')>()),
  fetchExamStrategies: vi.fn(async () => []),
}))
vi.mock('@/lib/telcPracticeApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/telcPracticeApi')>()),
  getPracticeOverview: vi.fn(async () => OVERVIEW),
  savePracticeDraft: h.draft,
  checkPracticeTeil: h.check,
  getPracticeMarks: h.getMarks,
  savePracticeMarks: h.saveMarks,
  resetPracticeTeil: h.reset,
}))

import PracticeTeilRoute from '@/app/v2/student/mock-exam/practice/teil/page'

const CONTEXT = [
  'Frau Özdemir leitet seit acht Jahren eine Freiwilligenagentur.',
  'Wer zu uns kommt, fragt zuerst',
  'nach dem Zeitaufwand. Ein Projekt über drei Monate finden viele gut.',
].join('\n')
const ITEMS = [
  { id: 'LV2-6', question: 'Frau Özdemir leitet …', options: { a: 'eine Schule.', b: 'eine Agentur.', c: 'einen Verein.' } },
  { id: 'LV2-7', question: 'Wer kommt, fragt zuerst, …', options: { a: 'wie viel Zeit es kostet.', b: 'ob es Geld gibt.', c: 'wer mitmacht.' } },
]
const OVERVIEW = {
  examId: 7,
  title: 'Modelltest 1',
  level: 'B1',
  format: 'TELC',
  sectionsJson: JSON.stringify({
    sections: [{ name: 'LESEN', teile: [{ teil: 2, type: 'MULTIPLE_CHOICE', context: CONTEXT, context_lines: true, items: ITEMS }] }],
  }),
  teile: [{ key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 2, maxPoints: 10, suggestMinutes: 20, progress: null }],
}
const result = (given: Record<string, string>) => ({
  teilKey: 'LESEN-2', type: 'MULTIPLE_CHOICE', score: 5, max: 10, correctCount: 1, total: 2, unusedOptions: [],
  items: [
    { id: 'LV2-6', label: '6', given: given['LV2-6'] ?? null, givenText: null, correct: 'b', correctText: 'eine Agentur.', answered: !!given['LV2-6'], isCorrect: given['LV2-6'] === 'b', points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['leitet seit acht Jahren eine Freiwilligenagentur'], need: null, rule: null },
    // câu trích vắt qua dòng tác giả ngắt: bản cũ không tô được
    { id: 'LV2-7', label: '7', given: given['LV2-7'] ?? null, givenText: null, correct: 'a', correctText: 'wie viel Zeit es kostet.', answered: !!given['LV2-7'], isCorrect: given['LV2-7'] === 'a', points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['fragt zuerst nach dem Zeitaufwand'], need: null, rule: null },
  ],
})

/** Bôi đen một cụm trong bài đọc như người dùng kéo chuột (vùng chọn + thả chuột). */
function selectInPassage(phrase: string, from = 0, to = phrase.length) {
  const seg = Array.from(document.querySelectorAll<HTMLElement>('[data-seg][data-b="ctx"]')).find((s) => s.textContent!.includes(phrase))!
  const node = seg.firstChild!
  const at = seg.textContent!.indexOf(phrase)
  const range = document.createRange()
  range.setStart(node, at + from)
  range.setEnd(node, at + to)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  fireEvent.pointerUp(document)
}

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  h.draft.mockResolvedValue(undefined)
  h.getMarks.mockResolvedValue({ marks: {}, updatedAt: null })
  h.saveMarks.mockImplementation(async (_e: number, _k: string, marks: unknown) => ({ marks, updatedAt: null }))
  h.reset.mockResolvedValue(undefined)
  h.check.mockImplementation(async (_e: number, _k: string, answers: Record<string, string>) => ({
    answers, checked: true, score: 5, max: 10, elapsedSeconds: 0, updatedAt: null, result: result(answers),
  }))
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

async function ready() {
  render(<PracticeTeilRoute />)
  await screen.findByText('Bút đánh dấu')
  await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(7, 'LESEN-2'))
}

describe('Đánh dấu bài đọc — luyện Teil', () => {
  it('có chú thích ba màu trên bài đọc (EXAM-210)', async () => {
    await ready()
    const legend = screen.getByRole('list', { name: 'Ý nghĩa màu' })
    expect(legend).toHaveTextContent('Vàng · từ khoá')
    expect(legend).toHaveTextContent('Xanh · bằng chứng')
    expect(legend).toHaveTextContent('Hồng · chưa chắc')
  })

  it('bôi đen giữa từ ⇒ tô cả từ, gắn câu ⇒ chip "Xem trong bài", lưu riêng với nháp (EXAM-192, 195, 198)', async () => {
    const user = userEvent.setup()
    await ready()
    // chọn "agt zuer" — giữa hai từ ⇒ mở rộng thành "fragt zuerst"
    selectInPassage('fragt zuerst', 2, 9)
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })
    await user.click(within(toolbar).getByRole('button', { name: 'Gắn vào câu' }))
    await user.click(within(toolbar).getByRole('button', { name: '7' }))

    const marked = document.querySelector<HTMLElement>('[data-seg].ga-mark-g')!
    expect(marked.textContent).toBe('fragt zuerst')
    expect(await screen.findByRole('button', { name: /Đã đánh dấu 1 chỗ · Xem trong bài/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã gắn vào câu 7, bấm để mở câu' })).toBeInTheDocument()

    await waitFor(() => expect(h.saveMarks).toHaveBeenCalled(), { timeout: 3000 })
    const pack = h.saveMarks.mock.calls.at(-1)![2] as { marks: Array<{ b: string; s: number; e: number; q: string; c: string }> }
    expect(pack.marks).toHaveLength(1)
    expect(CONTEXT.slice(pack.marks[0].s, pack.marks[0].e)).toBe('fragt zuerst')
    expect(pack.marks[0]).toMatchObject({ b: 'ctx', q: 'LV2-7', c: 'g' })
    expect(h.draft).not.toHaveBeenCalled() // đánh dấu không tạo nháp đáp án
  })

  it('tô xong rồi đổi màu, Ctrl+Z hoàn tác', async () => {
    const user = userEvent.setup()
    await ready()
    selectInPassage('Zeitaufwand')
    const toolbar = await screen.findByRole('toolbar')
    await user.click(within(toolbar).getByRole('button', { name: 'Vàng · từ khoá' }))
    expect(document.querySelector('[data-seg].ga-mark-y')?.textContent).toBe('Zeitaufwand')
    await user.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Hồng · chưa chắc' }))
    expect(document.querySelector('[data-seg].ga-mark-p')?.textContent).toBe('Zeitaufwand')
    await user.click(screen.getByRole('button', { name: 'Hoàn tác đánh dấu (Ctrl+Z)' }))
    expect(document.querySelector('[data-seg].ga-mark-y')?.textContent).toBe('Zeitaufwand')
  })

  it('ghi chú: lưu được, chữ trong ô có màu rõ (EXAM-196)', async () => {
    const user = userEvent.setup()
    await ready()
    selectInPassage('Ein Projekt')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: 'Ghi chú' }))
    const box = await screen.findByRole('textbox')
    expect(box.className).toContain('text-ga-ink')
    await user.type(box, 'drei Monate')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(screen.getByRole('button', { name: 'Ghi chú: drei Monate' })).toBeInTheDocument()
  })

  it('gạch bỏ phương án; chọn phương án đã gạch thì bỏ gạch (EXAM-197)', async () => {
    const user = userEvent.setup()
    await ready()
    const strike = screen.getAllByRole('button', { name: 'Gạch bỏ phương án a' })[0]
    await user.click(strike)
    expect(screen.getAllByRole('button', { name: 'Bỏ gạch phương án a' })[0]).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getAllByRole('radio', { name: /eine Schule/ })[0])
    expect(screen.getAllByRole('button', { name: 'Gạch bỏ phương án a' })[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('sau kiểm tra: chẩn đoán tìm bằng chứng; câu trích vắt hai dòng vẫn được tô (EXAM-201)', async () => {
    const user = userEvent.setup()
    await ready()
    // gắn câu 7 lệch chỗ (dòng 1)
    selectInPassage('Freiwilligenagentur')
    const toolbar = await screen.findByRole('toolbar')
    await user.click(within(toolbar).getByRole('button', { name: 'Gắn vào câu' }))
    await user.click(within(toolbar).getByRole('button', { name: '7' }))
    await user.click(screen.getAllByRole('radio', { name: /eine Agentur/ })[0])
    await user.click(screen.getAllByRole('radio', { name: /ob es Geld gibt/ })[0])
    await user.click(screen.getByRole('button', { name: /Kiểm tra Teil này/ }))

    // câu sai đầu tiên (7) mở sẵn phân tích
    expect(await screen.findByText('Bạn tìm bằng chứng thế nào')).toBeInTheDocument()
    expect(screen.getByText(/Bạn gắn câu này ở dòng 1, nhưng đáp án nằm ở dòng 2–3/)).toBeInTheDocument()
    expect(screen.getByText(/luyện dò từ khoá/)).toBeInTheDocument()
    const ev = Array.from(document.querySelectorAll('mark[data-evidence]')).map((m) => m.textContent).join('|')
    expect(ev).toBe('fragt zuerst|nach dem Zeitaufwand')
  })

  it('"Làm lại" hỏi giữ đánh dấu; bỏ chọn ⇒ server xoá cả đánh dấu (EXAM-209)', async () => {
    const user = userEvent.setup()
    await ready()
    selectInPassage('Zeitaufwand')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: 'Vàng · từ khoá' }))
    await user.click(screen.getByRole('button', { name: /Kiểm tra Teil này/ }))
    await user.click(await screen.findByRole('button', { name: 'Vẫn kiểm tra' }))
    await user.click(await screen.findByRole('button', { name: 'Làm lại' }))

    const dialog = await screen.findByRole('dialog')
    const keep = within(dialog).getByRole('checkbox', { name: 'Giữ đánh dấu trong bài' })
    expect(keep).toBeChecked()
    await user.click(keep)
    await user.click(within(dialog).getByRole('button', { name: 'Làm lại' }))
    await waitFor(() => expect(h.reset).toHaveBeenCalledWith(7, 'LESEN-2', false))
    await waitFor(() => expect(document.querySelector('[data-seg].ga-mark-y')).toBeNull())
  })

  it('đề đã sửa chữ ⇒ bỏ đánh dấu cũ, báo một dòng (EXAM-200)', async () => {
    h.getMarks.mockResolvedValue({
      marks: { v: 1, blocks: { ctx: 'deadbeef' }, marks: [{ id: 'h1', g: 'g1', b: 'ctx', s: 0, e: 4, k: 'hl', c: 'y', q: null, n: '' }], struck: {} },
      updatedAt: null,
    })
    await act(async () => {
      render(<PracticeTeilRoute />)
    })
    expect(await screen.findByText('Đề vừa được sửa chữ, đánh dấu cũ của bài này đã được bỏ.')).toBeInTheDocument()
    expect(document.querySelector('[data-seg].ga-mark-y')).toBeNull()
  })
})
