/**
 * Hợp đồng CATALOG: chuỗi dịch của /v2 không được mang emoji.
 *
 * VÌ SAO CẦN TEST NÀY: chính sách icon (02/09/2026) cấm emoji làm icon giao diện, nhưng lần quét
 * đó chỉ soi JSX. Emoji nằm TRONG chuỗi dịch ("⚡ Nội dung đang được chuẩn bị", "✅ Chính xác!",
 * "🎧 Nghe") đi vòng qua mọi phép quét mã nguồn: không file .tsx nào chứa ký tự đó, tsc im, lint
 * im — mà người học vẫn thấy một hình nhiều màu do font hệ điều hành vẽ, đứng cạnh icon Lucide
 * một màu của cùng khối. Nó cũng là mìn dịch thuật: dịch giả sao chép chuỗi rất dễ đánh rơi hoặc
 * đổi emoji, và không có gì báo.
 *
 * Ngoại lệ được liệt kê TỪNG KHOÁ ở dưới, không phải theo ký tự: thêm một emoji mới ở bất kỳ đâu
 * khác trong catalog /v2 sẽ làm test này đỏ, và người thêm phải nói rõ vì sao nó là NỘI DUNG.
 */
import { describe, expect, it } from 'vitest'
import { catalogMessages, type UiLocale } from '@/test/intlCatalog'

/** Dải emoji + ký hiệu tô màu; KHÔNG gồm mũi tên (→ ⇒) vốn là dấu câu trong bản tiếng Việt. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u

/**
 * Khoá được miễn — emoji ở đó là NỘI DUNG, không phải icon của giao diện:
 *   · cờ quốc gia — bộ Lucide không có cờ;
 *   · hướng dẫn cấp quyền micro — đang mô tả biểu tượng của TRÌNH DUYỆT, không phải của ta;
 *   · chú giải bảng mục tiêu — giải thích chính bộ glyph "— ✓ !" mà bảng đó vẽ.
 */
const ALLOW = new Set([
  'student.grammarAi.tabs.cultural',
  'student.micGuide.site',
  'student.examSpeaking.mic.deniedSteps.site',
  'teacher.objectives.legend',
])

function walk(node: unknown, path: string, out: string[]): void {
  if (typeof node === 'string') {
    if (EMOJI.test(node) && !ALLOW.has(path)) out.push(`${path} = ${node}`)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(child, `${path}[${i}]`, out))
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, out)
    }
  }
}

describe('catalog /v2 — emoji không được đóng vai icon', () => {
  for (const locale of ['vi', 'en', 'de'] as UiLocale[]) {
    it(`không còn emoji ngoài danh sách miễn trừ (${locale})`, () => {
      const found: string[] = []
      walk(catalogMessages(locale).v2, '', found)
      expect(found).toEqual([])
    })
  }

  it('danh sách miễn trừ vẫn trỏ đúng chuỗi có thật (không mục nào chết)', () => {
    const found: string[] = []
    walk(catalogMessages('vi').v2, '', found)
    expect(found).toEqual([])
    // Bỏ miễn trừ ⇒ đúng 4 khoá đó phải hiện ra; nếu không, danh sách đã lỗi thời.
    const withoutAllow: string[] = []
    const walkAll = (node: unknown, path: string): void => {
      if (typeof node === 'string') {
        if (EMOJI.test(node)) withoutAllow.push(path)
        return
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          walkAll(v, path ? `${path}.${k}` : k)
        }
      }
    }
    walkAll(catalogMessages('vi').v2, '')
    expect(new Set(withoutAllow)).toEqual(ALLOW)
  })
})
