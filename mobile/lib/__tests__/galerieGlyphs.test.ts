import { GLYPHS, GLYPH_NAMES, isGlyphName, type GlyphShape } from '../galerieGlyphs'

const LO = 1.5
const HI = 22.5

function boxOf(s: GlyphShape): [number, number, number, number] | null {
  if (typeof s === 'string') return null
  if ('r' in s) return [s.r[0], s.r[1], s.r[0] + s.r[2], s.r[1] + s.r[3]]
  return [s.c[0] - s.c[2], s.c[1] - s.c[2], s.c[0] + s.c[2], s.c[1] + s.c[2]]
}

describe('registry biểu tượng Galerie', () => {
  test('có glyph cho 4 tab và các trạng thái lõi', () => {
    for (const n of ['heute', 'hoc', 'speaking', 'hoso', 'chuoi', 'hoanthanh', 'khoa', 'xoa']) expect(isGlyphName(n)).toBe(true)
    expect(isGlyphName('không-có')).toBe(false)
  })

  test.each(GLYPH_NAMES)('%s: tên chữ thường, có nhãn, có nét mực, đúng MỘT mảng màu', (name) => {
    expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
    const g = GLYPHS[name]
    expect(g.label.trim().length).toBeGreaterThan(0)
    expect(g.ink.length).toBeGreaterThan(0)
    // Luật thương hiệu: mỗi glyph đúng một mảng vàng — riêng hành động huỷ dùng mảng đỏ thay vàng.
    expect(g.gold.length + (g.red?.length ?? 0)).toBe(1)
    if (g.red?.length) expect(g.gold.length).toBe(0)
  })

  test.each(GLYPH_NAMES)('%s: hình chữ nhật/vòng tròn nằm trong lưới 24 (chừa mép 1,5)', (name) => {
    const g = GLYPHS[name]
    for (const s of [...g.ink, ...g.gold, ...(g.red ?? [])]) {
      const b = boxOf(s)
      if (!b) continue
      expect(b[0]).toBeGreaterThanOrEqual(LO)
      expect(b[1]).toBeGreaterThanOrEqual(LO)
      expect(b[2]).toBeLessThanOrEqual(HI)
      expect(b[3]).toBeLessThanOrEqual(HI)
    }
  })

  test('chỉ xoá tài khoản dùng mảng đỏ', () => {
    const red = GLYPH_NAMES.filter((n) => (GLYPHS[n].red?.length ?? 0) > 0)
    expect(red).toEqual(['xoa'])
  })
})
