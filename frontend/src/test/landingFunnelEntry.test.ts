import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Chốt chặn QA 2026-09-01 (F-13).
 *
 * Đo trên bản chạy thật: trang chủ có 19 link, trong đó 8 CTA đều trỏ thẳng `/v2/register` và
 * KHÔNG một CTA nào trỏ `/v2/onboarding`. Phễu value-first — trang công khai, đã dịch ba thứ
 * tiếng, có ghép mentor, có "quick win", có đủ event PostHog — vì thế nằm không, và khách lạ bấm
 * "Học thử miễn phí" rơi thẳng vào form 5 ô kèm số điện thoại bắt buộc.
 *
 * Đây là kiểu lỗi cực dễ tái phát: chỉ cần một lần sửa giao diện gõ lại `href="/v2/register"` cho
 * quen tay là phễu lại mồ côi mà không ai nhận ra, vì không có gì hỏng — chỉ có tỉ lệ chuyển đổi
 * âm thầm tụt.
 */

const LANDING = join(__dirname, '..', 'components', 'landing-v2', 'GaLanding.tsx')

/** Bỏ chú thích để không bắt nhầm chính đoạn văn giải thích ở đầu tệp. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('trang chủ dẫn khách vào phễu onboarding', () => {
  const code = stripComments(readFileSync(LANDING, 'utf8'))

  it('điểm vào của CTA học viên là /v2/onboarding', () => {
    expect(code).toMatch(/const START_HREF = '\/v2\/onboarding'/)
  })

  it('CTA học viên dùng START_HREF chứ không hard-code /v2/register', () => {
    const viaFunnel = code.match(/href=\{START_HREF\}/g) ?? []
    // Header (desktop), menu mobile, hero, khối thi thử, CTA chân trang.
    expect(viaFunnel.length).toBeGreaterThanOrEqual(5)
  })

  it('bảng giá lấy đích theo từng gói, không dùng chung một href cứng', () => {
    expect(code).toMatch(/href=\{p\.href\}/)
    expect(code).toMatch(/cta: 'Bắt đầu ngay', href: START_HREF/)
    expect(code).toMatch(/cta: 'Dùng thử 7 ngày miễn phí', href: START_HREF/)
  })

  it('CTA B2B KHÔNG bị đẩy vào phễu học viên', () => {
    // Gói "Giáo viên" và nút tư vấn trung tâm phục vụ trung tâm, không phải người học.
    expect(code).toMatch(/cta: 'Nhận tư vấn', href: '\/v2\/register'/)
    expect(code).toMatch(/href="\/v2\/register"><YellowSq \/>Nhận tư vấn cho trung tâm/)
  })

  it('chỉ còn đúng một href /v2/register hard-code trong JSX — nút tư vấn trung tâm', () => {
    const hardCoded = code.match(/href="\/v2\/register"/g) ?? []
    expect(hardCoded).toHaveLength(1)
  })
})
