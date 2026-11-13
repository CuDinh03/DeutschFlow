/**
 * Gọi backend từ máy chủ Next qua mạng nội bộ (13/11/2026): ưu tiên `BACKEND_INTERNAL_URL`, lỗi MẠNG thì
 * lùi về địa chỉ công khai; mã HTTP lỗi trả nguyên vẹn để hợp đồng nơi gọi (404 → không có, 5xx → lỗi
 * tạm) không đổi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { internalBackendOrigin, publicBackendOrigin, serverBackendFetch } from '@/lib/serverBackend'

const PUBLIC = 'https://api.example.test'
const INTERNAL = 'http://deutschflow-api:8080'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', PUBLIC)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function stubFetch(impl: (url: string) => Promise<Response>) {
  const spy = vi.fn((url: string) => impl(url))
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('serverBackendFetch', () => {
  it('không đặt BACKEND_INTERNAL_URL (máy dev, CI) → gọi địa chỉ công khai', async () => {
    const spy = stubFetch(async () => new Response('{}', { status: 200 }))
    await serverBackendFetch('/api/public/occupations/koch')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(`${PUBLIC}/api/public/occupations/koch`)
  })

  it('có BACKEND_INTERNAL_URL → gọi nội bộ, không đụng địa chỉ công khai', async () => {
    vi.stubEnv('BACKEND_INTERNAL_URL', `${INTERNAL}/`)
    const spy = stubFetch(async () => new Response('{}', { status: 200 }))
    const res = await serverBackendFetch('/api/public/occupations/koch')
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(`${INTERNAL}/api/public/occupations/koch`)
  })

  it('lỗi mạng nội bộ → thử lại một lần qua địa chỉ công khai', async () => {
    vi.stubEnv('BACKEND_INTERNAL_URL', INTERNAL)
    const spy = stubFetch(async (url) => {
      if (url.startsWith(INTERNAL)) throw new TypeError('fetch failed')
      return new Response('{}', { status: 200 })
    })
    const res = await serverBackendFetch('/api/public/occupations/koch')
    expect(res.status).toBe(200)
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      `${INTERNAL}/api/public/occupations/koch`,
      `${PUBLIC}/api/public/occupations/koch`,
    ])
  })

  it.each([404, 429, 503])('nội bộ trả %i → trả nguyên mã đó, KHÔNG thử lại', async (status) => {
    vi.stubEnv('BACKEND_INTERNAL_URL', INTERNAL)
    const spy = stubFetch(async () => new Response('{}', { status }))
    const res = await serverBackendFetch('/api/public/occupations/koch')
    expect(res.status).toBe(status)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('chuẩn hoá địa chỉ: bỏ "/" và "/api" ở cuối', () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', `${PUBLIC}/api/`)
    vi.stubEnv('BACKEND_INTERNAL_URL', '  ')
    expect(publicBackendOrigin()).toBe(PUBLIC)
    expect(internalBackendOrigin()).toBeNull()
  })
})
