// Bộ biểu tượng Galerie — registry đọc từ `galerieGlyphs.json` (nguồn dữ liệu duy nhất).
// Cách vẽ, cách thêm glyph mới, luật hình học: xem `mobile/GALERIE_GLYPHS.md`.
//
// Mỗi glyph = các nét mực (`ink`, stroke) + ĐÚNG MỘT mảng vàng phẳng (`gold`, fill) — motif
// ô vàng của thương hiệu; `red` chỉ dùng cho hành động huỷ/xoá (thay cho mảng vàng).
// Hình vẽ trên lưới 24×24; component render là `components/ui/GaGlyph.tsx`.

import glyphs from './galerieGlyphs.json'

/** Hình chữ nhật phẳng: [x, y, width, height]. */
export type GlyphRect = { r: [number, number, number, number] }
/** Vòng tròn: [cx, cy, r]. */
export type GlyphCircle = { c: [number, number, number] }
/** Chuỗi = thuộc tính `d` của một SVG path. */
export type GlyphShape = string | GlyphRect | GlyphCircle

export interface GlyphDef {
  /** Nhãn tiếng Việt (dùng trong bảng kiểm và accessibility mặc định). */
  label: string
  ink: GlyphShape[]
  gold: GlyphShape[]
  red?: GlyphShape[]
}

export type GlyphName = keyof typeof glyphs

export const GLYPHS = glyphs as unknown as Record<GlyphName, GlyphDef>
export const GLYPH_NAMES = Object.keys(glyphs) as GlyphName[]
/** Lưới vẽ (viewBox 0 0 24 24). */
export const GLYPH_VIEWBOX = 24
/** Độ dày nét mực mặc định trên lưới 24. */
export const GLYPH_STROKE = 1.75

export function isGlyphName(value: unknown): value is GlyphName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(glyphs, value)
}
