import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * L3 — stream luyện nói phải tự làm mới đăng nhập khi access token (15 phút) hết hạn giữa phiên.
 *
 * Trên web refresh token là cookie HttpOnly: `getRefreshToken()` luôn trả `null`, nên đường làm mới
 * duy nhất đúng là `refreshAccessToken()` của api.ts (POST /api/auth/refresh, body rỗng, kèm cookie).
 * Test mock ở đúng hai tầng đó: `fetch` (stream) và adapter của axios (đường refresh) — phần còn lại
 * của api.ts chạy thật.
 */

const h = vi.hoisted(() => ({
  token: 'old-token' as string | null,
  supportMode: false,
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  markSupportSessionEnded: vi.fn(),
  setNeedsReauth: vi.fn(),
}))

vi.mock('@/lib/authSession', () => ({
  getAccessToken: () => h.token,
  // Đúng như web thật: refresh token không đọc được từ JavaScript.
  getRefreshToken: () => null,
  setTokens: h.setTokens,
  recordTokenRefresh: vi.fn(),
  clearTokens: h.clearTokens,
  isNative: () => false,
  getPlatform: () => 'web',
  isSupportMode: () => h.supportMode,
  markSupportSessionEnded: h.markSupportSessionEnded,
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/stores/useAuthRecoveryStore', () => ({
  useAuthRecoveryStore: { getState: () => ({ setNeedsReauth: h.setNeedsReauth }) },
}))
vi.mock('@/stores/useMaintenanceStore', () => ({
  useMaintenanceStore: { getState: () => ({ signal: vi.fn() }) },
}))

// Giá trị của hằng AI_SPEAKING_UNAUTHORIZED trong aiSpeakingApi.ts.
const UNAUTHORIZED = 'unauthorized'
const encoder = new TextEncoder()

function sseDone(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('event: done\ndata: {"sessionId":1}\n\n'))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function bearerOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit | undefined
  return new Headers(init?.headers).get('Authorization')
}

async function flush(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('stream không kết thúc kịp')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** Nạp module mới + cài adapter axios cho đường /auth/refresh. Trả bộ đếm số lần refresh. */
async function bootstrap(refresh: () => { status: number; data?: unknown }) {
  vi.resetModules()
  const axiosMod = await import('axios')
  const axios = axiosMod.default
  const plan = { refreshCount: 0 }
  axios.defaults.adapter = (async (config: { url?: string }) => {
    if (!String(config.url).includes('/auth/refresh')) throw new Error(`unexpected axios call ${config.url}`)
    plan.refreshCount += 1
    const out = refresh()
    const response = { status: out.status, statusText: '', data: out.data ?? {}, headers: {}, config }
    if (out.status >= 200 && out.status < 300) return response
    throw new axiosMod.AxiosError('http error', 'ECODE', config as never, null, response as never)
  }) as never
  const { chatStream } = await import('@/lib/aiSpeakingApi')
  return { chatStream, plan }
}

describe('chatStream — tự làm mới đăng nhập khi stream nhận 401 (L3)', () => {
  beforeEach(() => {
    h.token = 'old-token'
    h.supportMode = false
    h.setTokens.mockReset()
    h.setTokens.mockImplementation((data: { accessToken?: string }) => {
      h.token = data.accessToken ?? null
    })
    h.clearTokens.mockReset()
    h.clearTokens.mockImplementation(() => {
      h.token = null
    })
    h.markSupportSessionEnded.mockReset()
    h.setNeedsReauth.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('401 ở lần gọi đầu → làm mới bằng cookie rồi gọi lại stream với token mới, không báo UNAUTHORIZED', async () => {
    const { chatStream, plan } = await bootstrap(() => ({ status: 200, data: { accessToken: 'new-token' } }))
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(sseDone())
    const onDone = vi.fn()
    const onError = vi.fn()

    chatStream(1, 'Hallo', vi.fn(), onDone, onError)
    await flush(() => onDone.mock.calls.length > 0 || onError.mock.calls.length > 0)

    expect(onError).not.toHaveBeenCalledWith(UNAUTHORIZED)
    expect(onError).not.toHaveBeenCalled()
    expect(plan.refreshCount).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(fetch).mock.calls
    expect(bearerOf(calls[0])).toBe('Bearer old-token')
    expect(bearerOf(calls[1])).toBe('Bearer new-token')
    // Lần gọi lại phải mang đúng thân request ban đầu.
    expect((calls[1][1] as RequestInit).body).toBe((calls[0][1] as RequestInit).body)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('làm mới bị từ chối (401) → báo UNAUTHORIZED, không gọi lại stream', async () => {
    const { chatStream, plan } = await bootstrap(() => ({ status: 401 }))
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 401 }))
    const onError = vi.fn()

    chatStream(1, 'Hallo', vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError).toHaveBeenCalledWith(UNAUTHORIZED)
    expect(plan.refreshCount).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('token mới vẫn 401 → thử lại đúng MỘT lần rồi báo UNAUTHORIZED', async () => {
    const { chatStream, plan } = await bootstrap(() => ({ status: 200, data: { accessToken: 'new-token' } }))
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 401 }))
    const onError = vi.fn()

    chatStream(1, 'Hallo', vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError).toHaveBeenCalledWith(UNAUTHORIZED)
    expect(plan.refreshCount).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('tab phiên hỗ trợ: 401 → kết thúc phiên hỗ trợ, KHÔNG làm mới bằng cookie của admin', async () => {
    h.supportMode = true
    h.token = 'support-token'
    const { chatStream, plan } = await bootstrap(() => ({ status: 200, data: { accessToken: 'admin-token' } }))
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 401 }))
    const onError = vi.fn()

    chatStream(1, 'Hallo', vi.fn(), vi.fn(), onError)
    await flush(() => onError.mock.calls.length > 0)

    expect(onError).toHaveBeenCalledWith(UNAUTHORIZED)
    expect(h.markSupportSessionEnded).toHaveBeenCalled()
    expect(plan.refreshCount).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(bearerOf(vi.mocked(fetch).mock.calls[0])).toBe('Bearer support-token')
    expect(h.setTokens).not.toHaveBeenCalled()
  })
})
