/**
 * Trang "Chi phí" (`/chi-phi/`, owner chốt giá 14/11/2026 — QĐ-QG-17..26).
 *
 * Khoá: giá đúng quyết định, gói 2 tháng rẻ hơn hai kỳ gói tháng (chim mồi), chỉ gói chính mang nhãn,
 * không gạch giá / đếm ngược / "phổ biến nhất" / hứa kết quả (QLT-19), gói Miễn phí ghi đúng hiện trạng
 * (sau dùng thử không có hạn mức AI), trang được gắn vào sitemap, footer, llms.txt và chỉ có tiếng Việt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sitemap from '@/app/sitemap'
import { buildLlmsTxt } from '@/lib/llmsTxt'
import { isVietnameseOnlyPublicPath } from '@/lib/publicLocale'
import { COMPARE_ROWS, DESCRIPTION, FAQS, PATH, PLANS, SCHOOL, TITLE } from '@/data/chiPhiPage'
import landingVi from '../../messages/v2/landing.vi.json'

const PAGE = readFileSync(join(__dirname, '..', 'app', 'chi-phi', 'page.tsx'), 'utf8')
const vnd = (s: string) => Number(s.replace(/\D/g, ''))
const plan = (id: string) => {
  const p = PLANS.find((x) => x.id === id)
  if (!p) throw new Error(id)
  return p
}
const ALL_TEXT = JSON.stringify({ PLANS, COMPARE_ROWS, SCHOOL, FAQS, TITLE, DESCRIPTION })

describe('/chi-phi/ — giá', () => {
  it('đúng giá owner chốt: Miễn phí 0, Pro tháng 249k, Pro 2 tháng 399k, Tăng tốc 599k', () => {
    expect(PLANS.map((p) => [p.id, vnd(p.price)])).toEqual([
      ['free', 0],
      ['pro-month', 249000],
      ['pro-2m', 399000],
      ['boost-2m', 599000],
    ])
  })

  it('chim mồi: gói 2 tháng rẻ hơn hai kỳ gói tháng; câu so sánh trên thẻ khớp phép tính', () => {
    const month = vnd(plan('pro-month').price)
    const twoMonths = vnd(plan('pro-2m').price)
    expect(twoMonths).toBeLessThan(2 * month)
    expect(plan('pro-2m').perMonthNote).toContain(`${(2 * month - twoMonths).toLocaleString('vi-VN')}₫`)
    expect(plan('pro-2m').perMonthNote).toContain(`${(2 * month).toLocaleString('vi-VN')}₫`)
  })

  it('chỉ gói chính (2 tháng) có nhãn, và nhãn không phải "phổ biến nhất"', () => {
    expect(PLANS.filter((p) => p.badge).map((p) => p.id)).toEqual(['pro-2m'])
    expect(plan('pro-2m').badge).toBe('Gói chính')
  })

  it('Tăng tốc chỉ khác Pro ở hạn mức (gấp đôi); không ghi hạn mức bằng số token (owner 14/11/2026)', () => {
    const quota = COMPARE_ROWS.find((r) => r.label === 'Hạn mức AI mỗi ngày')
    expect(quota?.cells).toEqual(['Không có', 'Khoảng 4–5 phiên nói', 'Khoảng 4–5 phiên nói', 'Gấp đôi Pro'])
    expect(ALL_TEXT).not.toMatch(/token/i)
  })

  it('sổ lời hứa: không gạch giá, không đếm ngược, không hứa kết quả, không "không giới hạn"', () => {
    expect(PAGE).not.toMatch(/line-through/)
    expect(ALL_TEXT).not.toMatch(/phổ biến nhất|chỉ còn|còn \d+ (giờ|ngày)|hết hạn ưu đãi|không giới hạn|đỗ visa|cam kết đỗ/i)
    expect(FAQS.find((f) => f.q.includes('đỗ telc'))?.a).toContain('Không gói nào bảo đảm kết quả thi')
  })
})

describe('/chi-phi/ — hiện trạng và B2B', () => {
  it('gói Miễn phí sau dùng thử: không có hạn mức AI (DEFAULT = 0 token), không hứa "hạn mức mỗi ngày"', () => {
    expect(COMPARE_ROWS.find((r) => r.label === 'Hạn mức AI mỗi ngày')?.cells[0]).toBe('Không có')
    expect(ALL_TEXT).not.toContain('có hạn mức luyện AI mỗi ngày')
  })

  it('Android: ghi thật là nâng cấp qua app iPhone', () => {
    expect(FAQS.find((f) => f.q.includes('Android'))?.a).toContain('chỉ nâng cấp được trong app iPhone')
  })

  it('B2B: 75k / 65k trả trước 6 tháng / pilot 2 tuần miễn phí; chưa gồm VAT; định nghĩa theo DEC-20', () => {
    expect(SCHOOL.tiles.map((t) => t.value)).toEqual(['75.000₫', '65.000₫', '2 tuần miễn phí'])
    expect(SCHOOL.intro).toContain('chưa gồm VAT')
    expect(SCHOOL.definition).toContain('nộp ít nhất một bài hoặc được điểm danh')
    expect(SCHOOL.pilotNote).toContain('trừ vào hợp đồng')
  })

  it('khối giá trên /trung-tam/ khớp /chi-phi/', () => {
    const text = JSON.stringify(landingVi)
    expect(text).toContain('Trung tâm trả 75.000₫ cho mỗi học viên đang học mỗi tháng')
    expect(text).not.toContain('có hạn mức luyện AI mỗi ngày')
  })
})

describe('/chi-phi/ — SEO và điều hướng', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('title ≤ 60 ký tự, mô tả 120–160 ký tự, đường dẫn có / cuối', () => {
    expect(TITLE.length).toBeLessThanOrEqual(60)
    expect(DESCRIPTION.length).toBeGreaterThanOrEqual(120)
    expect(DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(PATH).toBe('/chi-phi/')
  })

  it('schema WebPage + FAQPage + BreadcrumbList; không Product/Offer (thanh toán web đang tắt)', () => {
    expect(PAGE).toContain("'@type': 'WebPage'")
    expect(PAGE).toContain("'@type': 'FAQPage'")
    expect(PAGE).toContain('breadcrumbStructuredData')
    expect(PAGE).not.toMatch(/'@type': '(Product|Offer)'/)
  })

  it('có trong sitemap, llms.txt; chỉ tiếng Việt', async () => {
    // Không gọi backend thật: mọi API trả 404 → sitemap chỉ còn trang tĩnh (đủ cho kiểm này).
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.some((u) => u.endsWith('/chi-phi/'))).toBe(true)
    expect(buildLlmsTxt()).toContain('/chi-phi/)')
    expect(isVietnameseOnlyPublicPath('/chi-phi/')).toBe(true)
  })
})
