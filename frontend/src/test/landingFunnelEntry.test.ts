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
    // 06/09/2026 (i18n): nhãn gói nằm trong catalog v2.landing; đích/highlight ở PLAN_META cùng
    // thứ tự (Miễn phí, Pro → phễu; Giáo viên → /v2/register).
    expect(code).toMatch(/href=\{meta\.href\}/)
    const planMeta = code.match(/const PLAN_META = \[([\s\S]*?)\]/)?.[1] ?? ''
    expect(planMeta.match(/href: START_HREF/g)).toHaveLength(2)
    expect(planMeta.match(/href: '\/v2\/register'/g)).toHaveLength(1)
  })

  it('CTA B2B KHÔNG bị đẩy vào phễu học viên', () => {
    // Gói "Giáo viên" và nút tư vấn trung tâm phục vụ trung tâm, không phải người học.
    expect(code).toMatch(/\{ href: '\/v2\/register', highlight: false \}/)
    expect(code).toMatch(/href="\/v2\/register"><YellowSq \/>\{t\('teachers\.ctaConsult'\)\}/)
  })

  it('chỉ còn đúng một href /v2/register hard-code trong JSX — nút tư vấn trung tâm', () => {
    const hardCoded = code.match(/href="\/v2\/register"/g) ?? []
    expect(hardCoded).toHaveLength(1)
  })

  /**
   * G5 — điểm vào phễu phải ĐO ĐƯỢC.
   *
   * Ba chặng sau đã có event từ trước (`register_success`, `onboarding_completed`,
   * `feature_lesson_completed`), nhưng chặng đầu thì không: CTA là <Link> trần nên chỉ còn
   * $autocapture, thứ không phân biệt được CTA phễu với 19 link khác trên trang. Thiếu nó thì
   * không tính được tỉ lệ CTA → đăng ký, tức không có baseline để so bất kỳ biến thể hero nào.
   *
   * Cùng lý do với các ca ở trên: chỉ cần một lần sửa giao diện gõ lại `<Link href={START_HREF}>`
   * cho quen tay là điểm đo lại mất, mà không có gì hỏng để ai nhận ra.
   */
  it('mọi CTA phễu đều bắn landing_cta_clicked kèm vị trí', () => {
    const funnelLinks = code.match(/href=\{START_HREF\}/g) ?? []
    const tracked = code.match(/trackCta\(/g) ?? []
    // 5 CTA START_HREF + CTA bảng giá (dùng meta.href) đều phải có điểm đo.
    expect(tracked.length).toBeGreaterThanOrEqual(funnelLinks.length + 1)
  })

  it('vị trí CTA là chỗ đứng trên trang, không phải nhãn nút', () => {
    // Nhãn đổi theo ngôn ngữ và theo mỗi lần viết lại copy; vị trí thì bền qua các lần thử biến thể.
    for (const placement of ['header', 'mobile_menu', 'hero', 'exam_section', 'footer_cta']) {
      expect(code).toContain(`trackCta('${placement}')`)
    }
    expect(code).toMatch(/trackCta\(`pricing_plan_\$\{i \+ 1\}`\)/)
  })

  it('tên event khớp thứ phân tích sẽ truy vấn', () => {
    expect(code).toMatch(/trackEvent\('landing_cta_clicked', \{ placement \}\)/)
  })
})
