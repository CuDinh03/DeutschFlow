import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockPath = '/'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))
// jsdom chạy trên localhost — giả tên miền thật để thành phần chịu chạy.
vi.mock('@/lib/analytics/googleAnalytics', async (orig) => ({
  ...(await orig<typeof import('@/lib/analytics/googleAnalytics')>()),
  isGaHost: () => true,
}))

const ID = 'G-JB5P4G4FXV'
const scriptTags = () => document.head.querySelectorAll(`script[src*="googletagmanager.com/gtag/js"]`)
const pageViews = () =>
  (window.dataLayer ?? [])
    .map((a) => Array.from(a as ArrayLike<unknown>))
    .filter((a) => a[0] === 'event' && a[1] === 'page_view')

describe('GoogleAnalytics', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    delete window.dataLayer
    delete window.gtag
    delete (window as unknown as Record<string, unknown>)[`ga-disable-${ID}`]
  })

  it('vào thẳng trang trong app: không tải script, không gửi gì', async () => {
    mockPath = '/v2/student/dashboard'
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    render(<GoogleAnalytics />)
    expect(scriptTags()).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
  })

  it('trang công khai: tải gtag một lần, gửi page_view; rời sang /v2 thì bật cờ tắt', async () => {
    mockPath = '/luyen-thi/telc-b1/'
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    const view = render(<GoogleAnalytics />)
    expect(scriptTags()).toHaveLength(1)
    expect(pageViews()).toHaveLength(1)
    const config = (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>)).find((a) => a[0] === 'config')
    expect(config?.[1]).toBe(ID)
    expect(config?.[2]).toEqual({ send_page_view: false })
    // page_location + send_page_view đặt bằng `set` TRƯỚC `config` — nếu nằm trong config, gtag tự bắn
    // thêm một page_view với URL thô (đo prod 15/11/2026).
    const entries = (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>))
    const firstSet = entries.findIndex((a) => a[0] === 'set')
    const configAt = entries.findIndex((a) => a[0] === 'config')
    expect(firstSet).toBeGreaterThanOrEqual(0)
    expect(firstSet).toBeLessThan(configAt)
    expect(entries[firstSet][1]).toMatchObject({ send_page_view: false, page_location: expect.any(String) })

    mockPath = '/v2/student/dashboard'
    view.rerender(<GoogleAnalytics />)
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${ID}`]).toBe(true)
    expect(pageViews()).toHaveLength(1)

    mockPath = '/phong-van/'
    view.rerender(<GoogleAnalytics />)
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${ID}`]).toBe(false)
    expect(scriptTags()).toHaveLength(1)
    expect(pageViews()).toHaveLength(2)
  })
})
