/**
 * Hợp đồng CATALOG: chuỗi dịch không được mang emoji — cả `/v2` LẪN catalog gốc.
 *
 * VÌ SAO CẦN TEST NÀY: chính sách icon (02/09/2026) cấm emoji làm icon giao diện, nhưng lần quét
 * đó chỉ soi JSX. Emoji nằm TRONG chuỗi dịch ("⚡ Nội dung đang được chuẩn bị", "✅ Chính xác!",
 * "🎧 Nghe") đi vòng qua mọi phép quét mã nguồn: không file .tsx nào chứa ký tự đó, tsc im, lint
 * im — mà người học vẫn thấy một hình nhiều màu do font hệ điều hành vẽ, đứng cạnh icon Lucide
 * một màu của cùng khối. Nó cũng là mìn dịch thuật: dịch giả sao chép chuỗi rất dễ đánh rơi hoặc
 * đổi emoji, và không có gì báo.
 *
 * Ngoại lệ được liệt kê TỪNG KHOÁ ở dưới, không phải theo ký tự: thêm một emoji mới ở bất kỳ đâu
 * khác trong catalog sẽ làm test này đỏ, và người thêm phải nói rõ vì sao nó là NỘI DUNG.
 *
 * Catalog GỐC canh riêng và KHÔNG có ngoại lệ nào. Nó từng giấu một 🎤 trong `personaNameHannie` —
 * khoá chết từ thời v1 (tên persona thật đến từ `lib/personas.ts`), nên không màn hình nào hiện nó
 * mà mỗi lượt tải trang vẫn chở đi. Lời chào persona có emoji thì nằm trong `lib/personas.ts`, là
 * lời NHÂN VẬT nói trong bong bóng chat — không thuộc phạm vi phép kiểm này.
 */
import { describe, expect, it } from 'vitest'
import { catalogMessages, type UiLocale } from '@/test/intlCatalog'

/**
 * Dải emoji + ký hiệu tô màu; KHÔNG gồm mũi tên (→ ⇒) vốn là dấu câu trong bản tiếng Việt.
 * Duyệt theo CODE POINT chứ không bằng regex cờ `u`: tsconfig không đặt `target` (⇒ ES5) nên cờ đó
 * là lỗi biên dịch TS1501 — đỏ trên CI dù vitest chạy được.
 */
const RANGES: [number, number][] = [
  [0x1f000, 0x1f2ff], // thẻ bài, chữ trong ô — gồm cả cờ (regional indicator)
  [0x1f300, 0x1faff], // khối emoji chính
  [0x2600, 0x27bf], // ☀ ✅ ❌ ✓ ✗ ✨ …
  [0x2b00, 0x2bff], // mũi tên/khối tô đậm
]

function hasEmoji(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const cp = text.codePointAt(i) ?? 0
    if (RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) return true
    if (cp > 0xffff) i += 1 // đã ăn cả cặp surrogate
  }
  return false
}

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
    if (hasEmoji(node) && !ALLOW.has(path)) out.push(`${path} = ${node}`)
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

describe('catalog GỐC — không emoji, không ngoại lệ', () => {
  for (const locale of ['vi', 'en', 'de'] as UiLocale[]) {
    it(`messages/${locale}.json sạch emoji`, () => {
      const found: string[] = []
      const { v2: _v2, ...base } = catalogMessages(locale) as Record<string, unknown>
      walk(base, '', found)
      expect(found).toEqual([])
    })
  }
})

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
        if (hasEmoji(node)) withoutAllow.push(path)
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
