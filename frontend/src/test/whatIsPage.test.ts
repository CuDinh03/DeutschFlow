/**
 * Trang "myDeutschFlow là gì?" (13/11/2026): meta đúng độ dài, không giá, không hứa kết quả, giữ đủ
 * các lưu ý trung thực của trang chủ (sổ lời hứa).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESCRIPTION, FAQS, FOUNDER, PATH, PATHWAYS, TITLE } from '@/data/whatIsPage'

const PAGE = readFileSync(join(__dirname, '..', 'app', 'mydeutschflow-la-gi', 'page.tsx'), 'utf8')
/** Chữ hiện ra trên trang: bỏ chú thích code (chú thích được phép nhắc luật "không hứa đỗ visa"). */
const PAGE_TEXT = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ALL_TEXT = [PAGE_TEXT, TITLE, DESCRIPTION, ...FAQS.flatMap((f) => [f.q, f.a]), ...PATHWAYS.flatMap((p) => Object.values(p))].join('\n')

describe('trang myDeutschFlow là gì', () => {
  it('title ≤ 60 ký tự, mô tả 120–160 ký tự, đường dẫn có / cuối', () => {
    expect(TITLE.length).toBeLessThanOrEqual(60)
    expect(DESCRIPTION.length).toBeGreaterThanOrEqual(120)
    expect(DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(PATH).toMatch(/^\/[a-z-]+\/$/)
  })

  it('không ghi giá gói trả phí (owner 13/11/2026: giá đổi)', () => {
    expect(ALL_TEXT).not.toMatch(/₫|\bVNĐ\b|299\.000|\/tháng/)
  })

  it('không hứa kết quả, không số liệu người dùng', () => {
    expect(ALL_TEXT).not.toMatch(/đỗ visa|đậu visa|cam kết|tỷ lệ đỗ|nghìn (người|học viên)|tăng lương/i)
  })

  it('giữ đủ lưu ý trung thực của trang chủ', () => {
    for (const note of ['đang ở giai đoạn Beta', 'B2 đang được xây dựng', 'Chưa có lộ trình C1', 'Chưa có đề thi tiếng Đức nghề nghiệp', 'không liên kết với telc']) {
      expect(ALL_TEXT, note).toContain(note)
    }
  })

  it('tên người sáng lập theo owner, có FAQPage + Article', () => {
    expect(FOUNDER).toBe('Đinh Huy Cự')
    expect(PAGE).toContain("'@type': 'FAQPage'")
    expect(PAGE).toContain("'@type': 'Article'")
  })
})
