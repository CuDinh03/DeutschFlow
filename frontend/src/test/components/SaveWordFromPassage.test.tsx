/**
 * Lưu từ khi luyện đề đọc (13/11/2026, owner chốt): bôi đen 1–5 từ ở Luyện Teil ⇒ "Lưu từ" ⇒ thẻ kết quả
 * (dạng gốc, nghĩa, chủ đề, đã vào lịch ôn) ⇒ "Bỏ lưu". Ca EXAM-227…231.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getMarks: vi.fn(),
  saveMarks: vi.fn(),
  saveWord: vi.fn(),
  removeWord: vi.fn(),
  search: { value: 'examId=7&teil=LESEN-2' },
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { seen: ['exam.teil'] } })), put: vi.fn(async () => ({ data: {} })), defaults: {} },
  apiMessage: () => 'lỗi',
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.search.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
  savePracticeDraft: vi.fn(async () => undefined),
  getPracticeMarks: h.getMarks,
  savePracticeMarks: h.saveMarks,
}))
vi.mock('@/lib/myWordsApi', () => ({
  myWordsApi: { save: h.saveWord, remove: h.removeWord, list: vi.fn() },
}))

import PracticeTeilRoute from '@/app/v2/student/mock-exam/practice/teil/page'

const CONTEXT = [
  'Frau Özdemir leitet seit acht Jahren eine Freiwilligenagentur.',
  'Wer zu uns kommt, fragt zuerst',
  'nach dem Zeitaufwand. Ein Projekt über drei Monate finden viele gut.',
].join('\n')
const OVERVIEW = {
  examId: 7,
  title: 'Modelltest 1',
  level: 'B1',
  format: 'TELC',
  sectionsJson: JSON.stringify({
    sections: [{
      name: 'LESEN',
      teile: [{
        teil: 2, type: 'MULTIPLE_CHOICE', context: CONTEXT, context_lines: true,
        items: [{ id: 'LV2-6', question: 'Frau Özdemir leitet …', options: { a: 'eine Schule.', b: 'eine Agentur.', c: 'einen Verein.' } }],
      }],
    }],
  }),
  teile: [{ key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 1, maxPoints: 5, suggestMinutes: 20, progress: null }],
}

const SAVED = {
  id: 41, lemma: 'Zeitaufwand', article: 'der', pos: 'NOUN', meaning: 'thời gian bỏ ra', topic: 'Beruf',
  topicLabel: 'Nghề nghiệp', surface: 'Zeitaufwand', sentence: null, examId: 7, examTitle: 'Modelltest 1',
  teilKey: 'LESEN-2', createdAt: '2026-11-13T10:00:00Z', alreadySaved: false,
}

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
  ;[h.getMarks, h.saveMarks, h.saveWord, h.removeWord].forEach((f) => f.mockReset())
  h.search.value = 'examId=7&teil=LESEN-2'
  h.getMarks.mockResolvedValue({ marks: {}, updatedAt: null })
  h.saveMarks.mockImplementation(async (_e: number, _k: string, marks: unknown) => ({ marks, updatedAt: null }))
  h.saveWord.mockResolvedValue(SAVED)
  h.removeWord.mockResolvedValue(undefined)
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
  Element.prototype.scrollTo = (() => undefined) as typeof Element.prototype.scrollTo
})

async function ready() {
  render(<PracticeTeilRoute />)
  await screen.findByText('Bút đánh dấu')
  await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(7, 'LESEN-2'))
}

describe('Lưu từ từ bài đọc — luyện Teil', () => {
  it('bôi một từ ⇒ "Lưu từ" gửi chữ, câu vắt dòng, đề/Teil/vị trí ⇒ thẻ kết quả (EXAM-227, 228)', async () => {
    const user = userEvent.setup()
    await ready()
    selectInPassage('Zeitaufwand')
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })
    await user.click(within(toolbar).getByRole('button', { name: /Lưu vào sổ từ/ }))

    expect(h.saveWord).toHaveBeenCalledTimes(1)
    const at = CONTEXT.indexOf('Zeitaufwand')
    expect(h.saveWord).toHaveBeenCalledWith({
      text: 'Zeitaufwand',
      sentence: 'Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand.',
      examId: 7,
      teilKey: 'LESEN-2',
      block: 'ctx',
      start: at,
      end: at + 'Zeitaufwand'.length,
    }, 'vi')
    const card = await screen.findByTestId('save-word-card')
    await within(card).findByText('Đã lưu vào sổ từ')
    expect(card).toHaveTextContent('der Zeitaufwand')
    expect(card).toHaveTextContent('thời gian bỏ ra')
    expect(card).toHaveTextContent('Chủ đề: Nghề nghiệp')
    expect(card).toHaveTextContent('Đã vào lịch ôn')
    // lưu từ không tạo đánh dấu trong bài
    expect(document.querySelector('[data-seg].ga-mark-y, [data-seg].ga-mark-g, [data-seg].ga-mark-p')).toBeNull()
  })

  it('"Bỏ lưu" gỡ từ vừa lưu (EXAM-229)', async () => {
    const user = userEvent.setup()
    await ready()
    selectInPassage('Zeitaufwand')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: /Lưu vào sổ từ/ }))
    const card = await screen.findByTestId('save-word-card')
    await user.click(await within(card).findByRole('button', { name: 'Bỏ lưu' }))
    expect(h.removeWord).toHaveBeenCalledWith(41)
    await within(card).findByText('Đã bỏ lưu từ này')
  })

  it('từ đã có trong sổ ⇒ báo đã có, không có "Bỏ lưu" (EXAM-230)', async () => {
    const user = userEvent.setup()
    h.saveWord.mockResolvedValue({ ...SAVED, alreadySaved: true })
    await ready()
    selectInPassage('Zeitaufwand')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: /Lưu vào sổ từ/ }))
    const card = await screen.findByTestId('save-word-card')
    await within(card).findByText('Từ này đã có trong sổ của bạn')
    expect(within(card).queryByRole('button', { name: 'Bỏ lưu' })).toBeNull()
  })

  it('quá trần tra nghĩa trong ngày (429) ⇒ báo rõ (EXAM-231)', async () => {
    const user = userEvent.setup()
    h.saveWord.mockRejectedValue({ response: { status: 429 } })
    await ready()
    selectInPassage('Zeitaufwand')
    await user.click(within(await screen.findByRole('toolbar')).getByRole('button', { name: /Lưu vào sổ từ/ }))
    const card = await screen.findByTestId('save-word-card')
    await within(card).findByText(/Hôm nay bạn đã lưu nhiều từ/)
  })

  it('vùng chọn quá 5 từ ⇒ không có nút "Lưu từ"', async () => {
    await ready()
    selectInPassage('Frau Özdemir leitet seit acht Jahren')
    const toolbar = await screen.findByRole('toolbar')
    expect(within(toolbar).queryByRole('button', { name: /Lưu vào sổ từ/ })).toBeNull()
  })
})

describe('Mở lại chỗ đã lưu từ sổ từ', () => {
  it('?at=…&w=… ⇒ đoạn chứa chữ được làm nổi (EXAM-236)', async () => {
    const at = CONTEXT.indexOf('Zeitaufwand')
    h.search.value = `examId=7&teil=LESEN-2&at=ctx:${at}:${at + 11}&w=Zeitaufwand`
    await ready()
    await waitFor(
      () => {
        const flashed = Array.from(document.querySelectorAll<HTMLElement>('[data-seg].ga-mark-flash'))
        expect(flashed.map((el) => el.textContent).join('')).toContain('Zeitaufwand')
      },
      { timeout: 2000 },
    )
  })

  it('đề đã sửa, chữ không còn ⇒ không làm nổi gì', async () => {
    h.search.value = 'examId=7&teil=LESEN-2&at=ctx:0:6&w=Urlaubsreise'
    await ready()
    await new Promise((r) => setTimeout(r, 600))
    expect(document.querySelector('[data-seg].ga-mark-flash')).toBeNull()
  })
})