import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SentenceFix } from '@/components/landing-v2/SentenceFix'
import landingVi from '../../../messages/v2/landing.vi.json'
import landingEn from '../../../messages/v2/landing.en.json'
import landingDe from '../../../messages/v2/landing.de.json'

vi.mock('@/components/ui-v2', () => ({
  GaCap: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

const report = (catalog: unknown): Record<string, string> => (catalog as { landing: { report: Record<string, string> } }).landing.report

const renderFix = (r = report(landingVi)) =>
  render(
    <SentenceFix
      quoteCap={r.quoteCap}
      quote={r.quote}
      wrong={r.quoteWrong}
      fixCap={r.fixCap}
      fix={r.fix}
      right={r.fixRight}
      why={r.fixWhy}
    />,
  )

const box = (container: HTMLElement) => container.firstElementChild as HTMLElement

class FakeObserver {
  static trigger: () => void
  constructor(cb: IntersectionObserverCallback) {
    FakeObserver.trigger = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  observe() {}
  disconnect() {}
}

describe('SentenceFix — câu được sửa trong báo cáo mẫu', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('trạng thái nghỉ đủ câu sai, câu đúng và lý do, không phụ thuộc chuyển động', () => {
    const r = report(landingVi)
    const { container } = renderFix()
    expect(box(container)).not.toHaveAttribute('data-fix-step')
    expect(container.querySelector('.ga-fix-wrong')?.textContent).toBe(r.quoteWrong)
    expect(container.querySelector('.ga-fix-right')?.textContent).toBe(r.fixRight)
    expect(screen.getByText(r.fixWhy)).toBeInTheDocument()
  })

  it.each([['vi', landingVi], ['en', landingEn], ['de', landingDe]])('catalog %s đánh dấu đúng đoạn có trong câu', (_, catalog) => {
    const r = report(catalog)
    expect(r.quote).toContain(r.quoteWrong)
    expect(r.fix).toContain(r.fixRight)
  })

  it('đoạn đánh dấu không có trong câu thì vẫn hiện nguyên câu', () => {
    const r: Record<string, string> = { ...report(landingVi), quoteWrong: 'không có' }
    const { container } = renderFix(r)
    expect(container.querySelector('.ga-fix-wrong')).toBeNull()
    expect(container.textContent).toContain(r.quote)
  })

  it('cuộn tới thì chạy qua các bước đúng một lần rồi về trạng thái nghỉ', () => {
    vi.useFakeTimers()
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const { container } = renderFix()

    act(() => FakeObserver.trigger())
    expect(box(container)).toHaveAttribute('data-fix-step', '0')
    act(() => { vi.advanceTimersByTime(700) })
    expect(box(container)).toHaveAttribute('data-fix-step', '1')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(box(container)).toHaveAttribute('data-fix-step', '2')
    act(() => { vi.advanceTimersByTime(900) })
    expect(box(container)).toHaveAttribute('data-fix-step', '3')
    act(() => { vi.advanceTimersByTime(500) })
    expect(box(container)).not.toHaveAttribute('data-fix-step')
  })

  it('giảm chuyển động: giữ nguyên trạng thái nghỉ khi cuộn tới', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const { container } = renderFix()
    act(() => FakeObserver.trigger())
    expect(box(container)).not.toHaveAttribute('data-fix-step')
  })
})
