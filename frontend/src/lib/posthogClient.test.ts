import { afterEach, describe, expect, it, vi } from 'vitest'

const capture = vi.fn()
const init = vi.fn()
vi.mock('posthog-js', () => ({ default: { capture, init } }))

import { __resetPostHogClientForTest, getPostHog, loadPostHog, withPostHog } from './posthogClient'

afterEach(() => {
  __resetPostHogClientForTest()
  capture.mockReset()
  init.mockReset()
})

describe('posthogClient', () => {
  it('xếp hàng lời gọi trước khi thư viện tải xong rồi chạy chúng theo thứ tự sau init', async () => {
    withPostHog((ph) => ph.capture('first'))
    withPostHog((ph) => ph.capture('second'))
    expect(capture).not.toHaveBeenCalled()
    expect(getPostHog()).toBeNull()

    await loadPostHog((ph) => ph.init('key'))

    expect(init).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls.map((c) => c[0])).toEqual(['first', 'second'])
  })

  it('sau khi tải xong thì gọi thẳng, không xếp hàng', async () => {
    await loadPostHog(() => {})
    withPostHog((ph) => ph.capture('now'))
    expect(capture).toHaveBeenCalledWith('now')
  })

  it('init chỉ chạy một lần dù loadPostHog được gọi nhiều lần (StrictMode gọi effect hai lần)', async () => {
    const initFn = vi.fn()
    await Promise.all([loadPostHog(initFn), loadPostHog(initFn)])
    await loadPostHog(initFn)
    expect(initFn).toHaveBeenCalledTimes(1)
  })

  it('hàng chờ có trần — máy chặn PostHog không làm phình bộ nhớ', async () => {
    for (let i = 0; i < 150; i++) withPostHog((ph) => ph.capture(`e${i}`))
    await loadPostHog(() => {})
    expect(capture).toHaveBeenCalledTimes(100)
  })
})
