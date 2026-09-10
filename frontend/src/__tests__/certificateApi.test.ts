import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * DEC-20 — client của sổ chứng nhận toàn trung tâm: tham số lọc chỉ gửi khi CÓ giá trị (máy chủ
 * phân biệt "không lọc" với `active=false`), phong bì thiếu trường không làm trang vỡ, và URL xác
 * thực công khai giữ đúng dạng canonical `/certificate/{token}/` (gạch chéo cuối).
 */
const get = vi.fn()
const post = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}))

import { certificateVerifyUrl, listOrgCertificates, revokeOrgCertificate } from '@/lib/certificateApi'

beforeEach(() => vi.clearAllMocks())

describe('listOrgCertificates', () => {
  it('không lọc: chỉ gửi page/size; `q` rỗng/khoảng trắng bị bỏ', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0, page: 0, size: 30 } })

    await listOrgCertificates(0, 30, { q: '   ' })

    expect(get).toHaveBeenCalledWith('/org/certificates', { params: { page: 0, size: 30 } })
  })

  it('`active=false` (đã thu hồi) và `classId` VẪN được gửi — false không phải "không lọc"', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0, page: 2, size: 30 } })

    await listOrgCertificates(2, 30, { q: ' Lan ', classId: 11, active: false })

    expect(get).toHaveBeenCalledWith('/org/certificates', {
      params: { page: 2, size: 30, q: 'Lan', classId: 11, active: false },
    })
  })

  it('phong bì thiếu trường → items [] / total 0, page/size lấy từ đối số', async () => {
    get.mockResolvedValue({ data: {} })

    const page = await listOrgCertificates(3, 20)

    expect(page).toEqual({ items: [], total: 0, page: 3, size: 20 })
  })
})

describe('revokeOrgCertificate', () => {
  it('POST /org/certificates/{id}/revoke với thân {reason}, trả dòng đã cập nhật', async () => {
    const updated = { id: 7, active: false, certificateCode: 'DF-B1-2026-ABC' }
    post.mockResolvedValue({ data: updated })

    const out = await revokeOrgCertificate(7, 'Cấp nhầm trình độ')

    expect(post).toHaveBeenCalledWith('/org/certificates/7/revoke', { reason: 'Cấp nhầm trình độ' })
    expect(out).toBe(updated)
  })
})

describe('certificateVerifyUrl', () => {
  it('ghép origin + /certificate/{token}/ — cắt gạch chéo thừa ở origin, mã hoá token', () => {
    expect(certificateVerifyUrl('tok123', 'https://mydeutschflow.com/')).toBe('https://mydeutschflow.com/certificate/tok123/')
    expect(certificateVerifyUrl('a b/c', 'https://x.test')).toBe('https://x.test/certificate/a%20b%2Fc/')
  })

  it('không truyền origin thì lấy origin của trang hiện tại', () => {
    expect(certificateVerifyUrl('tok')).toBe(`${window.location.origin}/certificate/tok/`)
  })
})
