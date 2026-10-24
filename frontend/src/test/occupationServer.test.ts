import { afterEach, describe, expect, it, vi } from 'vitest'
import { OccupationUnavailableError, fetchOccupationDetail, fetchOccupations } from '@/lib/occupationServer'

/**
 * Nghiệm thu prod 21/10/2026: backend 429 (frontend gọi từ một IP cho mọi khách) từng biến hàng loạt
 * trang nghề thành 404. Hợp đồng: chỉ 404 của backend mới là "không có nghề"; lỗi tạm phải ném lỗi.
 */
function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOccupationDetail', () => {
  it('backend 200 → trả chi tiết', async () => {
    mockFetch(async () => new Response(JSON.stringify({ occupation: { code: 'kellner' } }), { status: 200 }))
    await expect(fetchOccupationDetail('kellner')).resolves.toMatchObject({ occupation: { code: 'kellner' } })
  })

  it('backend 404 → null (trang 404)', async () => {
    mockFetch(async () => new Response('{}', { status: 404 }))
    await expect(fetchOccupationDetail('khong_co')).resolves.toBeNull()
  })

  it.each([429, 500, 503])('backend %i → ném OccupationUnavailableError, KHÔNG thành 404', async (status) => {
    mockFetch(async () => new Response('{}', { status }))
    await expect(fetchOccupationDetail('kellner')).rejects.toBeInstanceOf(OccupationUnavailableError)
  })

  it('lỗi mạng → ném OccupationUnavailableError', async () => {
    mockFetch(async () => { throw new TypeError('fetch failed') })
    await expect(fetchOccupationDetail('kellner')).rejects.toBeInstanceOf(OccupationUnavailableError)
  })

  it('mã sai định dạng → null, không gọi backend', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    await expect(fetchOccupationDetail('../admin')).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('fetchOccupations', () => {
  it('lỗi tạm → null (trang tổng hiện "chưa tải được", sitemap bỏ qua trang nghề)', async () => {
    mockFetch(async () => new Response('{}', { status: 429 }))
    await expect(fetchOccupations()).resolves.toBeNull()
  })
})
