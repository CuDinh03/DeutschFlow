import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

// Shared spies that survive vi.resetModules() (they live outside the module graph), so we can both
// program authSession behaviour and assert on it across fresh api.ts imports.
const h = vi.hoisted(() => ({
  getAccessToken: vi.fn<() => string | null>(() => null),
  getRefreshToken: vi.fn<() => string | null>(() => null),
  setTokens: vi.fn(),
  recordTokenRefresh: vi.fn(),
  clearTokens: vi.fn(),
  setNeedsReauth: vi.fn(),
  maintenanceSignal: vi.fn(),
}))

vi.mock('@/lib/authSession', () => ({
  getAccessToken: h.getAccessToken,
  getRefreshToken: h.getRefreshToken,
  setTokens: h.setTokens,
  recordTokenRefresh: h.recordTokenRefresh,
  clearTokens: h.clearTokens,
  isNative: () => false,
  getPlatform: () => 'web',
}))

vi.mock('@/stores/useAuthRecoveryStore', () => ({
  useAuthRecoveryStore: { getState: () => ({ setNeedsReauth: h.setNeedsReauth }) },
}))

// Store bảo trì: mock spy — signal() thật sẽ tự probe (fetch mạng) trong môi trường test.
vi.mock('@/stores/useMaintenanceStore', () => ({
  useMaintenanceStore: { getState: () => ({ signal: h.maintenanceSignal }) },
}))

type AdapterPlan = {
  // Count of POST /auth/refresh calls the adapter has seen.
  refreshCount: number
}

/**
 * Install a custom axios adapter (on both the api instance and the global axios used for /auth/refresh)
 * that routes by URL. A rejected promise with a `.response` is how axios surfaces an HTTP error to the
 * interceptor — resolving would be treated as success.
 */
async function bootstrap(
  route: (url: string, plan: AdapterPlan) => { status: number; data?: unknown; headers?: Record<string, string> },
) {
  vi.resetModules()
  h.getAccessToken.mockReturnValue(null)
  h.getRefreshToken.mockReturnValue(null)
  const axiosMod = await import('axios')
  const axios = axiosMod.default
  const AxiosError = axiosMod.AxiosError

  const plan: AdapterPlan = { refreshCount: 0 }

  const adapter = async (config: { url?: string; baseURL?: string; method?: string }) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`
    if (url.includes('/auth/refresh')) plan.refreshCount += 1
    const out = route(url, plan)
    const response = { status: out.status, statusText: '', data: out.data ?? {}, headers: out.headers ?? {}, config }
    if (out.status >= 200 && out.status < 300) {
      return response as never
    }
    return Promise.reject(new AxiosError('http error', 'ECODE', config as never, null, response as never))
  }

  axios.defaults.adapter = adapter as never
  const api = (await import('./api')).default as AxiosInstance
  api.defaults.adapter = adapter as never
  return { api, plan }
}

beforeEach(() => {
  h.setTokens.mockClear()
  h.recordTokenRefresh.mockClear()
  h.clearTokens.mockClear()
  h.setNeedsReauth.mockClear()
  h.maintenanceSignal.mockClear()
})

describe('api interceptor — refresh-storm latch', () => {
  it('attempts /auth/refresh only ONCE across many logged-out 401s, then short-circuits', async () => {
    // Everything 401s (logged out, no refresh cookie): /auth/me 401, /auth/refresh 401.
    const { api, plan } = await bootstrap((url) => ({
      status: 401,
      data: { message: url.includes('/auth/refresh') ? 'no refresh token' : 'no token' },
    }))

    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      try {
        await api.get('/auth/me')
      } catch (e) {
        statuses.push((e as { response?: { status?: number } }).response?.status ?? 0)
      }
    }

    // Exactly one refresh attempt — the storm that escalates the backend to 429 is prevented.
    expect(plan.refreshCount).toBe(1)
    // Every caller sees the ORIGINAL 401 (never a refresh-side 429), so they redirect cleanly.
    expect(statuses).toEqual([401, 401, 401, 401, 401])
    // Definitive auth failure cleared the stale client session exactly once.
    expect(h.clearTokens).toHaveBeenCalledTimes(1)
  })

  it('surfaces the ORIGINAL 401, not the refresh response, when refresh is rate-limited (429)', async () => {
    // First /auth/me 401 → refresh returns 429. We must reject with 401 and NOT clear tokens (429 is
    // transient — a valid session could just be rate-limited).
    const { api, plan } = await bootstrap((url) => {
      if (url.includes('/auth/refresh')) return { status: 429, data: { message: 'Too many refresh attempts' } }
      return { status: 401, data: { message: 'no token' } }
    })

    type CaughtErr = { response?: { status?: number } }
    let caught: CaughtErr | null = null
    try {
      await api.get('/auth/me')
    } catch (e) {
      caught = e as CaughtErr
    }
    expect(caught?.response?.status).toBe(401)
    expect(plan.refreshCount).toBe(1)
    // Transient 429 must NOT nuke the client session.
    expect(h.clearTokens).not.toHaveBeenCalled()

    // A subsequent 401 short-circuits (latch held) — still exactly one refresh attempt total.
    try {
      await api.get('/auth/me')
    } catch {
      /* expected */
    }
    expect(plan.refreshCount).toBe(1)
  })

  it('refreshes successfully and replays the request when the session is still alive', async () => {
    let meCalls = 0
    const { api, plan } = await bootstrap((url) => {
      if (url.includes('/auth/refresh')) return { status: 200, data: { accessToken: 'fresh' } }
      // First /auth/me 401 (expired), replay after refresh → 200.
      meCalls += 1
      return meCalls === 1 ? { status: 401, data: { message: 'expired' } } : { status: 200, data: { ok: true } }
    })

    const res = await api.get<{ ok: boolean }>('/auth/me')
    expect(res.data).toEqual({ ok: true })
    expect(plan.refreshCount).toBe(1)
    expect(h.setTokens).toHaveBeenCalledWith({ accessToken: 'fresh' })
    expect(h.recordTokenRefresh).toHaveBeenCalledTimes(1)
    expect(h.clearTokens).not.toHaveBeenCalled()
  })
})

// W6 audit lag 02/09 — kỷ luật retry: 1 lần, và CHỈ cho 502/503 (+ lỗi mạng). 500 là bug xác
// định — retry chỉ nhân đôi thời gian chờ và tải; 504 nghĩa là upstream đã treo hết một vòng
// timeout của nginx rồi.
describe('api interceptor — transient-only retry (W6)', () => {
  it('does NOT retry a 500 (deterministic server bug)', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 500, data: { message: 'boom' } }
    })

    await expect(api.get('/anything')).rejects.toMatchObject({ response: { status: 500 } })
    expect(calls).toBe(1)
  })

  it('retries a 503 exactly ONCE then surfaces the error', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 503, data: { message: 'brownout' } }
    })

    await expect(api.get('/anything')).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(2)
  }, 10_000)

  it('a 502 recovers on the single retry (deploy promote window)', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return calls === 1 ? { status: 502, data: {} } : { status: 200, data: { ok: true } }
    })

    const res = await api.get<{ ok: boolean }>('/anything')
    expect(res.data).toEqual({ ok: true })
    expect(calls).toBe(2)
  }, 10_000)

  it('never retries a POST, even on 503', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 503, data: {} }
    })

    await expect(api.post('/grade', { x: 1 })).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(1)
  })
})

// Thiết kế plans/2026-09-03 §7: 503 bảo trì là server nghỉ CÓ CHỦ ĐÍCH — interceptor
// (đăng ký TRƯỚC retry) bắn tín hiệu vào store và retry KHÔNG được lặp lại request.
describe('api interceptor — maintenance mode', () => {
  const MAINTENANCE_BODY = {
    type: 'https://deutschflow.com/errors/maintenance',
    status: 503,
    detail: 'Hệ thống đang bảo trì, dự kiến hoạt động lại lúc 23:30.',
    extensions: { code: 'MAINTENANCE', windowId: 12, title: 'Nâng cấp CSDL', endsAtUtc: '2026-09-10T16:30:00Z' },
  }

  it('503 code=MAINTENANCE: signal store + KHÔNG retry (khác 503 thường vốn retry 1 lần)', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 503, data: MAINTENANCE_BODY }
    })

    await expect(api.get('/anything')).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(1) // không nhân tải lên server đang nghỉ
    expect(h.maintenanceSignal).toHaveBeenCalledTimes(1)
    expect(h.maintenanceSignal).toHaveBeenCalledWith(
      expect.objectContaining({ windowId: 12, title: 'Nâng cấp CSDL', endsAtUtc: '2026-09-10T16:30:00Z' }),
    )
  })

  it('nhánh nginx tĩnh: header X-DF-Maintenance cũng là tín hiệu, kể cả body không parse được', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 503, data: 'Service Unavailable', headers: { 'x-df-maintenance': '1' } }
    })

    await expect(api.get('/anything')).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(1)
    expect(h.maintenanceSignal).toHaveBeenCalledTimes(1)
  })

  it('503 thường (không mã bảo trì) giữ nguyên hành vi retry-một-lần, không signal', async () => {
    let calls = 0
    const { api } = await bootstrap(() => {
      calls += 1
      return { status: 503, data: { message: 'brownout' } }
    })

    await expect(api.get('/anything')).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(2)
    expect(h.maintenanceSignal).not.toHaveBeenCalled()
  }, 10_000)
})
