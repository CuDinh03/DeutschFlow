/**
 * Đánh dấu bài đọc trên màn hẹp / cảm ứng (đợt 2b, 10/11/2026 — ca EXAM-202). Nhấn giữ chọn chữ ⇒ đợi
 * người dùng kéo xong hai đầu ⇒ thanh công cụ neo đáy màn (không nổi cạnh vùng chọn, không đè menu chọn
 * chữ của hệ thống) ⇒ tô; ô ghi chú ở đầu màn.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ draft: vi.fn(), getMarks: vi.fn(), saveMarks: vi.fn(), coarse: false, wide: false }))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(async () => ({ data: { seen: ['exam.teil'] } })), put: vi.fn(async () => ({ data: {} })), defaults: {} },
  apiMessage: () => 'lỗi',
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('examId=7&teil=LESEN-2'),
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
  savePracticeDraft: h.draft,
  getPracticeMarks: h.getMarks,
  savePracticeMarks: h.saveMarks,
}))

import PracticeTeilRoute from '@/app/v2/student/mock-exam/practice/teil/page'

const CONTEXT = ['Frau Özdemir leitet seit acht Jahren eine Freiwilligenagentur.', 'Wer zu uns kommt, fragt zuerst nach dem Zeitaufwand.'].join('\n')
const OVERVIEW = {
  examId: 7,
  title: 'Modelltest 1',
  level: 'B1',
  format: 'TELC',
  sectionsJson: JSON.stringify({
    sections: [{ name: 'LESEN', teile: [{ teil: 2, type: 'MULTIPLE_CHOICE', context: CONTEXT, context_lines: true, items: [
      { id: 'LV2-6', question: 'Frau Özdemir leitet …', options: { a: 'eine Schule.', b: 'eine Agentur.', c: 'einen Verein.' } },
    ] }] }],
  }),
  teile: [{ key: 'LESEN-2', section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', items: 1, maxPoints: 5, suggestMinutes: 20, progress: null }],
}

/** Nhấn giữ rồi kéo hai đầu: vùng chọn đổi trong lúc ngón tay còn trên màn, không có `pointerup` ngay. */
function longPressSelect(phrase: string) {
  const seg = Array.from(document.querySelectorAll<HTMLElement>('[data-seg][data-b="ctx"]')).find((s) => s.textContent!.includes(phrase))!
  const at = seg.textContent!.indexOf(phrase)
  fireEvent.pointerDown(seg, { pointerType: 'touch' })
  const range = document.createRange()
  range.setStart(seg.firstChild!, at)
  range.setEnd(seg.firstChild!, at + phrase.length)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-ga-marking')
  ;[h.draft, h.getMarks, h.saveMarks].forEach((f) => f.mockReset())
  h.draft.mockResolvedValue(undefined)
  h.getMarks.mockResolvedValue({ marks: {}, updatedAt: null })
  h.saveMarks.mockImplementation(async (_e: number, _k: string, marks: unknown) => ({ marks, updatedAt: null }))
  window.matchMedia = ((q: string) => ({
    matches: q.includes('pointer: coarse') ? h.coarse : q.includes('min-width') ? h.wide : false,
    media: q, onchange: null,
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

describe('Đánh dấu bài đọc — màn hẹp / cảm ứng (đợt 2b)', () => {
  it('điện thoại: nhấn giữ chọn chữ ⇒ thanh công cụ neo đáy màn ⇒ tô được (EXAM-202)', async () => {
    const user = userEvent.setup()
    h.wide = false
    h.coarse = true
    render(<PracticeTeilRoute />)
    expect(await screen.findByText(/Nhấn giữ một chữ để chọn/)).toBeInTheDocument()

    longPressSelect('Zeitaufwand')
    // còn đang kéo hai đầu: chưa bật thanh ngay
    expect(screen.queryByRole('toolbar', { name: 'Công cụ đánh dấu' })).toBeNull()
    const toolbar = await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' }, { timeout: 2000 })
    expect(toolbar).toHaveAttribute('data-docked')
    expect(toolbar.style.bottom).toContain('12px')
    // nhường chỗ cho bài đọc: thanh dưới của khung ẩn, ngăn câu hỏi thu về 0; màu có tên ngắn
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-ga-marking'))
    expect(document.querySelector('section[aria-hidden="true"]')).not.toBeNull()
    expect(within(toolbar).getByText('Bằng chứng')).toBeInTheDocument()

    await user.click(within(toolbar).getByRole('button', { name: 'Vàng · từ khoá' }))
    await waitFor(() => expect(h.saveMarks).toHaveBeenCalled(), { timeout: 4000 })
    expect((h.saveMarks.mock.calls.at(-1)![2] as { marks: Array<{ c: string }> }).marks).toEqual([expect.objectContaining({ c: 'y' })])

    // ghi chú mở ở đầu màn (bàn phím ảo không che)
    await user.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Ghi chú' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.style.top).toContain('8px')
    await act(async () => undefined)
  }, 10_000)

  it('gợi ý dài chỉ tự mở lần đầu; lần sau nằm sau nút "?"', async () => {
    const user = userEvent.setup()
    h.wide = false
    h.coarse = true
    window.localStorage.setItem('df.marks.touchHintSeen', '1')
    render(<PracticeTeilRoute />)
    const how = await screen.findByRole('button', { name: 'Cách dùng bút đánh dấu' })
    expect(screen.queryByText(/Nhấn giữ một chữ để chọn/)).toBeNull()
    expect(screen.getByRole('list', { name: 'Ý nghĩa màu' })).toHaveTextContent('Từ khoá')
    await user.click(how)
    expect(screen.getByText(/Nhấn giữ một chữ để chọn/)).toBeInTheDocument()
  })

  it('máy tính bảng cảm ứng, màn rộng: vẫn neo đáy màn', async () => {
    h.wide = true
    h.coarse = true
    render(<PracticeTeilRoute />)
    await screen.findByText(/Nhấn giữ một chữ để chọn/)
    longPressSelect('Freiwilligenagentur')
    expect(await screen.findByRole('toolbar', { name: 'Công cụ đánh dấu' }, { timeout: 2000 })).toHaveAttribute('data-docked')
  })

  it('máy tính chuột: thanh nổi cạnh vùng chọn như cũ', async () => {
    h.wide = true
    h.coarse = false
    render(<PracticeTeilRoute />)
    expect(await screen.findByText(/Bôi đen chữ trong bài hoặc trong câu hỏi/)).toBeInTheDocument()
  })
})
