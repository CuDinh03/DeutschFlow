/**
 * A5 (kế hoạch cải thiện trang chủ 08/11/2026): clip luyện thi 24 giây ở trang chủ bản vi.
 * Tự chạy khi vào màn, có nút dừng (WCAG 2.2.2), đã dừng thì không tự chạy lại, giảm chuyển động
 * thì không tự chạy.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXAM_CLIP_POSTER, EXAM_CLIP_SRC, ExamClip } from '@/components/landing-v2/ExamClip'

vi.mock('@/components/ui-v2', () => ({ GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> }))

let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null
let reduced = false

beforeEach(() => {
  ioCallback = null
  reduced = false
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { ioCallback = cb }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
  // jsdom không phát media: play/pause giả, bắn sự kiện như trình duyệt thật.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true })
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: true, configurable: true })
    this.dispatchEvent(new Event('pause'))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderClip = () =>
  render(<ExamClip caption="Quay màn hình thật" label="Video 24 giây" playLabel="Phát video" pauseLabel="Dừng video" accent="red" />)

describe('ExamClip', () => {
  it('video không tải trước (preload none), có poster, không tiếng, mô tả cho trình đọc màn hình', () => {
    const { container } = renderClip()
    const video = container.querySelector('video')!
    expect(video.getAttribute('src')).toBe(EXAM_CLIP_SRC)
    expect(video.getAttribute('poster')).toBe(EXAM_CLIP_POSTER)
    expect(video.getAttribute('preload')).toBe('none')
    expect(video.muted).toBe(true)
    expect(video.getAttribute('aria-label')).toBe('Video 24 giây')
  })

  it('vào màn thì chạy; bấm dừng thì dừng, cuộn ra vào lại KHÔNG tự chạy', () => {
    renderClip()
    act(() => ioCallback!([{ isIntersecting: true }]))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dừng video' }))
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Phát video' })).toBeTruthy()

    act(() => ioCallback!([{ isIntersecting: false }]))
    act(() => ioCallback!([{ isIntersecting: true }]))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Phát video' }))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2)
  })

  it('giảm chuyển động: không tự chạy, vẫn bấm phát được', () => {
    reduced = true
    renderClip()
    expect(ioCallback).toBeNull()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Phát video' }))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })
})
