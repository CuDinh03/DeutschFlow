import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * QLT-20 (A1 09/11/2026): PostHogProvider phải
 *   1. gửi pageview với URL đã lọc (không token query, không token trong path);
 *   2. init PostHog với before_send lọc mọi thuộc tính URL tự gắn + hàm che URL cho bản ghi phiên;
 *   3. không ghi phiên trên trang chia sẻ có token.
 */

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  register: vi.fn(),
  stopSessionRecording: vi.fn(),
  startSessionRecording: vi.fn(),
  persistence: { props: {} as Record<string, unknown>, register: vi.fn() },
}))
vi.mock('posthog-js', () => ({ default: ph }))

let pathname = '/v2/activate'
let search = 'token=SECRET1&utm_source=mail'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}))

import { PostHogProvider } from '@/providers/PostHogProvider'
import { __resetPostHogClientForTest } from '@/lib/posthogClient'

type InitConfig = {
  before_send: (cr: unknown) => { properties: Record<string, unknown>; $set_once?: Record<string, unknown> } | null
  disable_session_recording: boolean
  mask_personal_data_properties: boolean
  session_recording: { maskCapturedNetworkRequestFn: (r: { name: string }) => { name: string } }
}

function initConfig(): InitConfig {
  return ph.init.mock.calls[0][1] as InitConfig
}

beforeEach(() => {
  pathname = '/v2/activate'
  search = 'token=SECRET1&utm_source=mail'
  window.history.replaceState(null, '', `${pathname}?${search}`)
})

afterEach(() => {
  __resetPostHogClientForTest()
  Object.values(ph).forEach((f) => typeof f === 'function' && f.mockReset())
  ph.persistence.register.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('PostHogProvider — lọc token (QLT-20)', () => {
  it('pageview mang URL đã lọc; init có before_send lọc $current_url/$referrer/$pathname/$initial_*…', async () => {
    render(<PostHogProvider><div /></PostHogProvider>)
    await waitFor(() => expect(ph.init).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ph.capture).toHaveBeenCalledWith('$pageview', expect.anything()))

    const pageview = ph.capture.mock.calls.find((c) => c[0] === '$pageview')!
    expect(pageview[1].$current_url).toBe(`${window.origin}/v2/activate?utm_source=mail`)

    const cfg = initConfig()
    expect(cfg.mask_personal_data_properties).toBe(true)
    const out = cfg.before_send({
      uuid: 'u',
      event: '$autocapture',
      properties: {
        $current_url: 'https://x.com/v2/org/accept?token=SECRET2',
        $referrer: 'https://x.com/certificate/SECRET3',
        $pathname: '/phieu/SECRET4',
        $session_entry_url: 'https://x.com/v2/activate?token=SECRET1',
      },
      $set_once: {
        $initial_current_url: 'https://x.com/v2/activate?token=SECRET1',
        $initial_referrer: 'https://x.com/report/SECRET5',
      },
    })
    expect(JSON.stringify(out)).not.toMatch(/SECRET/)

    expect(cfg.session_recording.maskCapturedNetworkRequestFn({ name: 'https://api.x.com/api/auth/activate?token=SECRET1' }).name)
      .toBe('https://api.x.com/api/auth/activate')
    expect(cfg.disable_session_recording).toBe(false)
  })

  it('trên trang chia sẻ có token: tắt ghi phiên ngay từ init, pageview che path', async () => {
    pathname = '/certificate/SECRET3'
    search = 'lang=en'
    window.history.replaceState(null, '', `${pathname}?${search}`)

    render(<PostHogProvider><div /></PostHogProvider>)
    await waitFor(() => expect(ph.init).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ph.capture).toHaveBeenCalledWith('$pageview', expect.anything()))

    expect(initConfig().disable_session_recording).toBe(true)
    const pageview = ph.capture.mock.calls.find((c) => c[0] === '$pageview')!
    expect(pageview[1].$current_url).toBe(`${window.origin}/certificate/:token?lang=en`)
  })
})
