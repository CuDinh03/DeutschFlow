/**
 * Rà câu chữ trang công khai (owner 14/11/2026): chặn các lỗi nặng quay lại.
 *
 * - Không nêu số commit (owner bỏ câu "hơn 1.600 lần commit").
 * - Không hứa tính năng "đang (được) biên soạn" (đề thi nghề nghiệp, bộ câu hỏi đã có).
 * - Nói "không cần thanh toán trước", không nói "không cần thẻ" / "no credit card" / "Kreditkarte".
 * - Trang /privacy chỉ có một tên tiếng Việt: "Chính sách bảo mật".
 * - /free-grade không hiện chuỗi `message` của backend (câu cũ hứa "chấm không giới hạn").
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildLlmsTxt } from '@/lib/llmsTxt'
import * as chiPhi from '@/data/chiPhiPage'
import * as whatIs from '@/data/whatIsPage'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { GERMAN_EXAMS } from '@/data/germanExams'
import landingVi from '../../messages/v2/landing.vi.json'
import landingEn from '../../messages/v2/landing.en.json'
import landingDe from '../../messages/v2/landing.de.json'
import authVi from '../../messages/v2/auth.vi.json'
import authEn from '../../messages/v2/auth.en.json'
import authDe from '../../messages/v2/auth.de.json'
import chromeVi from '../../messages/v2/chrome.vi.json'
import chromeEn from '../../messages/v2/chrome.en.json'
import chromeDe from '../../messages/v2/chrome.de.json'

const APP = join(__dirname, '..', 'app')
/** Chữ hiện ra trên trang: bỏ chú thích code (chú thích được nhắc lại luật). */
const pageText = (...parts: string[]) =>
  readFileSync(join(APP, ...parts), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const PUBLIC_PAGES = [
  ['mydeutschflow-la-gi', 'page.tsx'],
  ['chi-phi', 'page.tsx'],
  ['support', 'page.tsx'],
  ['privacy', 'page.tsx'],
  ['luyen-thi', 'page.tsx'],
  ['luyen-thi', '[slug]', 'page.tsx'],
  ['free-grade', 'page.tsx'],
  ['free-grade', 'client-page.tsx'],
  ['cam-nang', 'page.tsx'],
  ['cam-nang', '[slug]', 'page.tsx'],
].map((p) => pageText(...p))

const authPublic = (a: { auth: { login: object; register: object } }) => JSON.stringify([a.auth.login, a.auth.register])
const chromeError = (c: { error: object }) => JSON.stringify(c.error)

const ALL_PUBLIC = [
  JSON.stringify(landingVi),
  JSON.stringify(landingEn),
  JSON.stringify(landingDe),
  authPublic(authVi),
  authPublic(authEn),
  authPublic(authDe),
  chromeError(chromeVi),
  chromeError(chromeEn),
  chromeError(chromeDe),
  JSON.stringify(chiPhi),
  JSON.stringify(whatIs),
  JSON.stringify(GUIDE_ARTICLES),
  JSON.stringify(GERMAN_EXAMS),
  buildLlmsTxt(),
  ...PUBLIC_PAGES,
].join('\n')

describe('câu chữ trang công khai — luật đã chốt', () => {
  it('không nêu số commit', () => {
    expect(ALL_PUBLIC).not.toMatch(/\bcommits?\b/i)
  })

  it('không hứa "đang (được) biên soạn"', () => {
    expect(ALL_PUBLIC).not.toMatch(/đang (được )?biên soạn/i)
  })

  it('không nói "không cần thẻ" / "no credit card" / "Kreditkarte"', () => {
    expect(ALL_PUBLIC).not.toMatch(/không cần thẻ|credit card|no card|kreditkarte|keine karte/i)
  })

  it('trang /privacy chỉ mang tên "Chính sách bảo mật" ở bản tiếng Việt', () => {
    expect(ALL_PUBLIC).not.toMatch(/Chính sách quyền riêng tư/)
    expect(landingVi.landing.footer.privacy).toBe('Chính sách bảo mật')
    expect(landingVi.landing.schools.data.privacyLink).toContain('Chính sách bảo mật')
    expect(readFileSync(join(APP, 'privacy', 'page.tsx'), 'utf8')).toContain("title: 'Chính sách bảo mật · myDeutschFlow'")
    expect(readFileSync(join(__dirname, '..', 'content', 'legal', 'privacy.ts'), 'utf8')).not.toContain('Chính sách quyền riêng tư')
  })

  it('/free-grade không hiện chuỗi message của backend', () => {
    const client = readFileSync(join(APP, 'free-grade', 'client-page.tsx'), 'utf8')
    expect(client).not.toMatch(/\{result\.message\}/)
    expect(PUBLIC_PAGES.join('\n')).not.toMatch(/chấm không giới hạn|tiêu chí bài viết B1|kèm câu sửa/)
  })

  it('giá trung tâm không công khai, giá Pro không ghi "từ 249.000₫"', () => {
    for (const cat of [landingVi, landingEn, landingDe]) {
      expect(JSON.stringify(cat.landing.schools)).not.toMatch(/₫|phí chạy thử|pilot fee|Pilotgebühr/)
    }
    expect(ALL_PUBLIC).not.toMatch(/từ 249\.000₫|from 249,000₫|ab 249\.000₫/)
  })

  it('đã bỏ khối bảng giá ẩn ở trang chủ', () => {
    for (const cat of [landingVi, landingEn, landingDe]) expect('pricing' in cat.landing).toBe(false)
  })
})
