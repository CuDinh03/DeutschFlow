/**
 * Hướng dẫn lần đầu (đợt (e) làm mới Luyện thi, 07/11/2026): tự mở khi màn chưa xem, khoanh từng vùng,
 * Enter tiếp / Esc bỏ qua, lưu đã xem theo tài khoản; đã xem thì không tự mở, nút dấu hỏi mở lại.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookOpen, ListChecks } from 'lucide-react'

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), toast: vi.fn() }))
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))
vi.mock('@/lib/api', () => ({ default: { get: h.get, put: h.put } }))
vi.mock('sonner', () => ({ toast: h.toast }))

import { TourHelpButton, useScreenTour } from '@/components/exam/tour/ScreenTour'
import { loadSeenTours, markTourSeen, resetTourCache } from '@/lib/uiToursApi'

function Screen({ ready = true }: { ready?: boolean }) {
  const tour = useScreenTour({
    key: 'exam.demo',
    ready,
    steps: [
      { target: 'a', icon: BookOpen, title: 'Bài đọc', body: 'Đọc ở đây.' },
      { target: 'missing', icon: BookOpen, title: 'Không có', body: 'Vùng này không có trên màn.' },
      { target: 'b', icon: ListChecks, title: 'Ô số câu', body: 'Bấm để nhảy.' },
    ],
  })
  return (
    <div>
      <TourHelpButton onClick={tour.start} />
      <section data-tour="a">A</section>
      <section data-tour="b">B</section>
      {tour.familiar && <p>đã quen</p>}
      <p>{tour.active ? 'đang mở' : 'đóng'}</p>
      {tour.overlay}
    </div>
  )
}

const rects = Element.prototype.getClientRects
beforeEach(() => {
  resetTourCache()
  window.localStorage.clear()
  h.get.mockReset()
  h.put.mockReset()
  h.toast.mockReset()
  h.put.mockResolvedValue({ data: { seen: [] } })
  // jsdom không tính bố cục: coi mọi phần tử đang hiện là có hình.
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList
  }
})
afterEach(() => {
  Element.prototype.getClientRects = rects
  vi.useRealTimers()
})

describe('Hướng dẫn lần đầu', () => {
  it('chưa xem: tự mở, bỏ bước không có vùng, Enter tiếp, xong lưu theo tài khoản và nhắc nút dấu hỏi', async () => {
    h.get.mockResolvedValue({ data: { seen: [] } })
    render(<Screen />)
    const dialog = await screen.findByRole('dialog', {}, { timeout: 2000 })
    expect(dialog).toHaveTextContent('Bài đọc')
    expect(screen.getByRole('img', { name: 'Bước 1/2' })).toBeInTheDocument()
    expect(h.put).toHaveBeenCalledWith('/auth/me/tours/exam.demo')
    expect(screen.getByText('đã quen')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toHaveTextContent('Ô số câu')
    expect(screen.queryByText('Không có')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Bắt đầu/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.toast).toHaveBeenCalledWith('Bấm dấu hỏi để xem lại hướng dẫn')
    expect(JSON.parse(window.localStorage.getItem('df.tours.seen') ?? '[]')).toContain('exam.demo')
  })

  it('đã xem: không tự mở; nút dấu hỏi mở lại, Esc đóng không nhắc', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    h.get.mockResolvedValue({ data: { seen: ['exam.demo'] } })
    render(<Screen />)
    expect(await screen.findByText('đã quen')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Bài đọc')
    expect(screen.getByText('đang mở')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.toast).not.toHaveBeenCalled()
    expect(h.put).not.toHaveBeenCalled()
  })

  it('màn chưa tải xong thì chưa mở', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    h.get.mockResolvedValue({ data: { seen: [] } })
    render(<Screen ready={false} />)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Lưu hướng dẫn đã xem', () => {
  it('máy chủ lỗi: dùng bản trên máy; đánh dấu ghi máy dù máy chủ lỗi', async () => {
    window.localStorage.setItem('df.tours.seen', JSON.stringify(['exam.today']))
    h.get.mockRejectedValue(new Error('offline'))
    h.put.mockRejectedValue(new Error('offline'))
    expect(Array.from(await loadSeenTours())).toEqual(['exam.today'])
    await markTourSeen('exam.set')
    expect(JSON.parse(window.localStorage.getItem('df.tours.seen')!)).toEqual(['exam.today', 'exam.set'])
  })

  it('gộp danh sách máy chủ với bản trên máy, chỉ đọc máy chủ một lần', async () => {
    window.localStorage.setItem('df.tours.seen', JSON.stringify(['exam.set']))
    h.get.mockResolvedValue({ data: { seen: ['exam.today'] } })
    const a = await loadSeenTours()
    await loadSeenTours()
    expect(Array.from(a).sort()).toEqual(['exam.set', 'exam.today'])
    expect(h.get).toHaveBeenCalledTimes(1)
  })
})
