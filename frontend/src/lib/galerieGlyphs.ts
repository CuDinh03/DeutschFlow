import data from './galerieGlyphs.json'

/**
 * Bộ biểu tượng Galerie của web. `galerieGlyphs.json` là BẢN SAO NGUYÊN VẸN của
 * `mobile/lib/galerieGlyphs.json` (web và mobile là hai package riêng): test `galerieGlyphs.test.ts`
 * đỏ khi hai bản lệch nhau. Thêm hoặc sửa glyph ở mobile trước theo `mobile/GALERIE_GLYPHS.md` rồi
 * chép sang đây.
 */

/** Chuỗi `d` của SVG path, hoặc `{r:[x,y,w,h]}` (hình chữ nhật), hoặc `{c:[cx,cy,r]}` (vòng tròn). */
export type GlyphShape = string | { r: number[] } | { c: number[] }

export interface GlyphDef {
  label: string
  ink: GlyphShape[]
  gold: GlyphShape[]
  red?: GlyphShape[]
}

export type GlyphName = keyof typeof data

export const GLYPHS: Record<GlyphName, GlyphDef> = data
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[]
