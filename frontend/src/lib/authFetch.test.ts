import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  token: 'old-token' as string | null,
  supportMode: false,
  refreshAccessToken: vi.fn<() => Promise<string | null>>(),
  markSupportSessionEnded: vi.fn(),
}))

// Tầng làm mới token đã có test riêng (api.test.ts) — ở đây chỉ kiểm hợp đồng của authFetch với nó.
vi.mock('@/lib/api', () => ({ refreshAccessToken: h.refreshAccessToken }))
vi.mock('@/lib/authSession', () => ({
  getAccessToken: () => h.token,
  isSupportMode: () => h.supportMode,
  markSupportSessionEnded: h.markSupportSessionEnded,
}))

import { authFetch } from './authFetch'

const URL_ = 'http://backend.test/api/thing'
const r401 = () => new Response(null, { status: 401 })
const r200 = () => new Response('ok', { status: 200 })

function initOf(n: number): RequestInit {
  return vi.mocked(fetch).mock.calls[n][1] as RequestInit
}
function bearerOf(n: number): string | null {
  return new Headers(initOf(n).headers).get('Authorization')
}

describe('authFetch', () => {
  beforeEach(() => {
    h.token = 'old-token'
    h.supportMode = false
    h.refreshAccessToken.mockReset()
    h.markSupportSessionEnded.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gắn Bearer + credentials include, giữ header/method/signal của nơi gọi', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(r200())
    const ctrl = new AbortController()

    const res = await authFetch(URL_, { method: 'POST', headers: { Accept: 'text/event-stream' }, body: '{}', signal: ctrl.signal })

    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(URL_)
    expect(bearerOf(0)).toBe('Bearer old-token')
    expect(new Headers(initOf(0).headers).get('Accept')).toBe('text/event-stream')
    expect(initOf(0).method).toBe('POST')
    expect(initOf(0).credentials).toBe('include')
    expect(initOf(0).signal).toBe(ctrl.signal)
    expect(h.refreshAccessToken).not.toHaveBeenCalled()
  })

  it('không có token → không gắn header Authorization', async () => {
    h.token = null
    vi.mocked(fetch).mockResolvedValueOnce(r200())

    await authFetch(URL_)

    expect(bearerOf(0)).toBeNull()
  })

  it('tôn trọng credentials do nơi gọi chỉ định', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(r200())

    await authFetch(URL_, { credentials: 'omit' })

    expect(initOf(0).credentials).toBe('omit')
  })

  it('401 → làm mới rồi gửi lại đúng một lần với token mới, cùng body và signal', async () => {
    h.refreshAccessToken.mockResolvedValueOnce('new-token')
    vi.mocked(fetch).mockResolvedValueOnce(r401()).mockResolvedValueOnce(r200())
    const ctrl = new AbortController()
    const body = new FormData()
    body.append('k', 'v')

    const res = await authFetch(URL_, { method: 'POST', body, signal: ctrl.signal })

    expect(res.status).toBe(200)
    expect(h.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(bearerOf(1)).toBe('Bearer new-token')
    expect(initOf(1).body).toBe(body)
    expect(initOf(1).signal).toBe(ctrl.signal)
  })

  it('token mới vẫn 401 → trả 401, không làm mới lần hai', async () => {
    h.refreshAccessToken.mockResolvedValue('new-token')
    vi.mocked(fetch).mockImplementation(async () => r401())

    const res = await authFetch(URL_)

    expect(res.status).toBe(401)
    expect(h.refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('phiên chết dứt khoát (refresh trả null) → trả phản hồi 401 gốc', async () => {
    h.refreshAccessToken.mockResolvedValueOnce(null)
    const original = r401()
    vi.mocked(fetch).mockResolvedValueOnce(original)

    const res = await authFetch(URL_)

    expect(res).toBe(original)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refresh thất bại thoáng qua (ném lỗi) → trả phản hồi 401 gốc, không ném', async () => {
    h.refreshAccessToken.mockRejectedValueOnce(new Error('429'))
    const original = r401()
    vi.mocked(fetch).mockResolvedValueOnce(original)

    await expect(authFetch(URL_)).resolves.toBe(original)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('tab phiên hỗ trợ: 401 → đánh dấu phiên hỗ trợ kết thúc, KHÔNG làm mới', async () => {
    h.supportMode = true
    h.token = 'support-token'
    vi.mocked(fetch).mockResolvedValueOnce(r401())

    const res = await authFetch(URL_)

    expect(res.status).toBe(401)
    expect(bearerOf(0)).toBe('Bearer support-token')
    expect(h.markSupportSessionEnded).toHaveBeenCalledTimes(1)
    expect(h.refreshAccessToken).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('body là ReadableStream (không dựng lại được) → không làm mới, không gửi lại', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(r401())
    const body = new ReadableStream<Uint8Array>()

    const res = await authFetch(URL_, { method: 'POST', body })

    expect(res.status).toBe(401)
    expect(h.refreshAccessToken).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('nơi gọi đã huỷ (signal aborted) → không làm mới, không gửi lại', async () => {
    const ctrl = new AbortController()
    vi.mocked(fetch).mockImplementationOnce(async () => {
      ctrl.abort()
      return r401()
    })

    const res = await authFetch(URL_, { signal: ctrl.signal })

    expect(res.status).toBe(401)
    expect(h.refreshAccessToken).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('lỗi mạng của fetch được ném nguyên cho nơi gọi', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(authFetch(URL_)).rejects.toThrow('Failed to fetch')
  })
})
