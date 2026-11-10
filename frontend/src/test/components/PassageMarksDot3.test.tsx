/**
 * Đánh dấu bài đọc đợt 3 (10/11/2026): Lesen 1 (đoạn văn từng câu), Lesen 3 (mẩu rao vặt), Sprachbausteine
 * (thư có chỗ trống) ở luyện Teil. Bôi đen ⇒ thanh công cụ ⇒ tô, lưu vào đúng khối; rao vặt vẫn bấm chọn
 * được; sau kiểm tra Lesen 1 có chẩn đoán theo đoạn văn của câu.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  search: '',
  overview: null as unknown,
  check: vi.fn(),
  draft: vi.fn(),
  getMarks: vi.fn(),
  saveMarks: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { seen: ['exam.teil'] } })), put: vi.fn(async () => ({ data: {} })), defaults: {} },
  apiMessage: () => 'lỗi',
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.search),
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
  getPracticeOverview: vi.fn(async () => h.overview),
  savePracticeDraft: h.draft,
  checkPracticeTeil: h.check,
  getPracticeMarks: h.getMarks,
  savePracticeMarks: h.saveMarks,
}))

import PracticeTeilRoute from '@/app/v2/student/mock-exam/practice/teil/page'

function overview(section: string, teil: Record<string, unknown>, key: string, items: number) {
  return {
    examId: 7,
    title: 'Modelltest 1',
    level: 'B1',
    format: 'TELC',
    sectionsJson: JSON.stringify({ sections: [{ name: section, teile: [teil] }] }),
    teile: [{ key, section, teil: teil.teil, type: teil.type, items, maxPoints: 25, suggestMinutes: 15, progress: null }],
  }
}

const LESEN1 = {
  teil: 1,
  type: 'MATCH_HEADLINE',
  headlines: { a: 'Neue Radwege in Leipzig', b: 'Markthalle öffnet wieder', c: 'Streik im Nahverkehr' },
  items: [
    { id: 'LV1-1', question: 'Text 1', text: 'Ab Mai entstehen in Leipzig vier neue Strecken, die nur für Fahrräder sind.' },
    { id: 'LV1-2', question: 'Text 2', text: 'Nach zwei Jahren Umbau öffnet die alte Markthalle am Domshof.' },
  ],
}
const LESEN3 = {
  teil: 3,
  type: 'MATCH_AD_X',
  allow_none: true,
  ads: { a: 'Nachhilfe Mathe, Klasse 5–10, bei mir zu Hause.', b: 'Babysitterin hat abends und am Wochenende Zeit.' },
  items: [
    { id: 'LV3-11', question: 'Ihre Tochter braucht Hilfe in Mathe.' },
    { id: 'LV3-12', question: 'Sie suchen jemanden für den Samstagabend.' },
  ],
}
const SB = {
  teil: 1,
  type: 'GAP_MC',
  gapped_text: 'Sehr geehrte ___21___ Herren,\n\nich wohne seit drei Jahren in der Hafenstraße.',
  items: [{ id: 'SB1-21', gap: 21, options: { a: 'Damen', b: 'Frauen', c: 'Leute' } }],
}

/** Bôi đen một cụm trong khối `b` như người dùng kéo chuột. */
function select(block: string, phrase: string) {
  const seg = Array.from(document.querySelectorAll<HTMLElement>(`[data-seg][data-b="${block}"]`)).find((s) => s.textContent!.includes(phrase))!
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

async function lastSavedMarks() {
  await waitFor(() => expect(h.saveMarks).toHaveBeenCalled(), { timeout: 4000 })
  return (h.saveMarks.mock.calls.at(-1)![2] as { marks: Array<{ b: string; c: string }> }).marks
}

beforeEach(() => {
  ;[h.check, h.draft, h.getMarks, h.saveMarks, h.push].forEach((f) => f.mockReset())
  h.draft.mockResolvedValue(undefined)
  h.getMarks.mockResolvedValue({ marks: {}, updatedAt: null })
  h.saveMarks.mockImplementation(async (_e: number, _k: string, marks: unknown) => ({ marks, updatedAt: null }))
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

describe('Đánh dấu bài đọc đợt 3 — luyện Teil', () => {
  it('Lesen 1: tô trong đoạn văn của câu; sau kiểm tra chẩn đoán theo đoạn văn đó', async () => {
    const user = userEvent.setup()
    h.search = 'examId=7&teil=LESEN-1'
    h.overview = overview('LESEN', LESEN1, 'LESEN-1', 2)
    h.check.mockImplementation(async (_e: number, _k: string, answers: Record<string, string>) => ({
      answers, checked: true, score: 0, max: 50, elapsedSeconds: 0, updatedAt: null,
      result: {
        teilKey: 'LESEN-1', type: 'MATCH_HEADLINE', score: 0, max: 50, correctCount: 0, total: 2, unusedOptions: [],
        items: [
          { id: 'LV1-1', label: '1', given: null, givenText: null, correct: 'a', correctText: 'Neue Radwege in Leipzig', answered: false, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['nur für Fahrräder'], need: null, rule: null },
          { id: 'LV1-2', label: '2', given: null, givenText: null, correct: 'b', correctText: 'Markthalle öffnet wieder', answered: false, isCorrect: false, points: 0, whyRight: null, whyWrong: null, trap: null, evidence: ['öffnet die alte Markthalle'], need: null, rule: null },
        ],
      },
    }))
    render(<PracticeTeilRoute />)
    await screen.findByText('Bút đánh dấu')
    await waitFor(() => expect(h.getMarks).toHaveBeenCalledWith(7, 'LESEN-1'))

    select('t:LV1-1', 'Leipzig')
    await user.click(within(await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })).getByRole('button', { name: 'Vàng · từ khoá' }))
    expect(await lastSavedMarks()).toEqual([expect.objectContaining({ b: 't:LV1-1', c: 'y' })])

    await user.click(screen.getByRole('button', { name: /Kiểm tra Teil này/ }))
    await user.click(await screen.findByRole('button', { name: 'Vẫn kiểm tra' }))
    expect(await screen.findByText('Bạn tìm bằng chứng thế nào')).toBeInTheDocument()
    // vàng ở "Leipzig" không trùng chỗ đáp án "nur für Fahrräder" ⇒ chưa đánh dấu chỗ chứa đáp án
    expect(screen.getByText(/Đáp án nằm ở đoạn văn câu 1/)).toBeInTheDocument()
    // bằng chứng tô ngay trong đoạn văn của câu đang xem
    expect(document.querySelector('#pq-LV1-1 mark[data-evidence]')).toHaveTextContent('nur für Fahrräder')
  }, 10_000)

  it('Lesen 3: tô trong mẩu rao vặt không chọn mẩu đó; bấm thường vẫn chọn', async () => {
    const user = userEvent.setup()
    h.search = 'examId=7&teil=LESEN-3'
    h.overview = overview('LESEN', LESEN3, 'LESEN-3', 2)
    render(<PracticeTeilRoute />)
    await screen.findByText('Bút đánh dấu')

    select('ad:b', 'abends')
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })
    // thả chuột sau khi bôi đen: không tính là chọn mẩu b
    fireEvent.click(document.querySelector('[data-b="ad:b"]')!)
    expect(screen.getByRole('radio', { name: /Babysitterin/ })).toHaveAttribute('aria-checked', 'false')
    await user.click(within(toolbar).getByRole('button', { name: 'Xanh · bằng chứng' }))
    expect(await lastSavedMarks()).toEqual([expect.objectContaining({ b: 'ad:b', c: 'g' })])

    window.getSelection()!.removeAllRanges()
    await user.click(screen.getByRole('radio', { name: /Nachhilfe Mathe/ }))
    // đã gán cho câu 11 (trang chuyển sang câu kế tiếp ⇒ mẩu a hiện "ở câu 11")
    expect(screen.getByRole('radio', { name: /Nachhilfe Mathe/ })).toHaveTextContent('ở câu 11')
    expect(screen.getByRole('radio', { name: /Babysitterin/ })).not.toHaveTextContent('ở câu')
  }, 10_000)

  it('Sprachbausteine: tô chữ trong thư quanh chỗ trống, chỗ trống vẫn bấm được', async () => {
    const user = userEvent.setup()
    h.search = 'examId=7&teil=SPRACHBAUSTEINE-1'
    h.overview = overview('SPRACHBAUSTEINE', SB, 'SPRACHBAUSTEINE-1', 1)
    render(<PracticeTeilRoute />)
    await screen.findByText('Bút đánh dấu')

    select('gap', 'seit drei Jahren')
    await user.click(within(await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' })).getByRole('button', { name: 'Hồng · chưa chắc' }))
    const marks = await lastSavedMarks()
    expect(marks).toEqual([expect.objectContaining({ b: 'gap', c: 'p' })])
    expect(screen.getByRole('button', { name: 'Chỗ 21' })).toBeInTheDocument()
  }, 10_000)
})
