/**
 * Bộ glyph Galerie của web: bản sao phải khớp mobile từng ký tự, và giữ các luật hình học của
 * `mobile/GALERIE_GLYPHS.md`. Đơn giản hơn test mobile vì web không tự thêm glyph, chỉ chép sang.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLYPHS, GLYPH_NAMES, type GlyphName } from '@/lib/galerieGlyphs'
import { ROLE_AREAS, localItems, studentAreas, teacherAreas } from '@/components/ui-v2/nav'

describe('bộ glyph Galerie', () => {
  it('khớp nguyên vẹn với bản của mobile', () => {
    const mobile = readFileSync(join(process.cwd(), '..', 'mobile', 'lib', 'galerieGlyphs.json'), 'utf8')
    expect(GLYPHS).toEqual(JSON.parse(mobile))
  })

  it.each(GLYPH_NAMES)('%s có nét mực và đúng một mảng màu', (name) => {
    const g = GLYPHS[name]
    expect(g.ink.length).toBeGreaterThan(0)
    expect(g.gold.length + (g.red?.length ?? 0)).toBe(1)
  })
})

describe('glyph trong điều hướng', () => {
  it('năm khu của học viên và giáo viên đều có glyph riêng cho từng khu', () => {
    for (const role of [studentAreas, teacherAreas]) {
      const glyphs = role.areas.map((a) => a.glyph)
      expect(glyphs.every(Boolean)).toBe(true)
      expect(new Set(glyphs).size).toBe(glyphs.length)
    }
  })

  it('mọi glyph khai trong nav đều có thật trong bộ', () => {
    const used: (GlyphName | undefined)[] = Object.values(ROLE_AREAS).flatMap((role) => [
      role?.inbox?.glyph,
      ...(role?.areas ?? []).flatMap((a) => [a.glyph, ...localItems(a).map((i) => i.glyph)]),
    ])
    for (const name of used) {
      if (name) expect(GLYPH_NAMES).toContain(name)
    }
  })

  it('chỉ các mục chưa có glyph hợp nghĩa mới còn dùng Lucide', () => {
    const lucide = studentAreas.areas.flatMap(localItems).filter((i) => !i.glyph).map((i) => i.id)
    expect(lucide.filter((id) => id !== 'book-session').sort()).toEqual(['game', 'news'])
  })
})
