// Huy hiệu ở tab Tiến bộ (giao diện v3.4, Đợt 6C): mobile không hiện emoji (GALERIE_GLYPHS.md),
// nên `iconEmoji` của máy chủ được thay bằng glyph Galerie theo nhóm mã, và emoji dính trong
// tên huy hiệu (V111: "Junior IT 💻") được bỏ khi hiển thị.
import type { GlyphName } from '@/lib/galerieGlyphs'

/** Glyph nhận diện theo nhóm mã huy hiệu (seed V58/V111); mã lạ dùng glyph hoàn thành. */
export function achievementGlyph(code: string | null | undefined): GlyphName {
  const c = (code ?? '').toUpperCase()
  if (c === 'FIRST_SPEAK' || c.startsWith('SPEAK_')) return 'noi'
  if (c.startsWith('XP_')) return 'xp'
  if (c.startsWith('STREAK_')) return 'chuoi'
  if (c.startsWith('ERRORS_FIXED')) return 'sualoi'
  if (c.startsWith('SATELLITE_') || c.startsWith('INDUSTRY_')) return 'hoc'
  return 'hoanthanh'
}

export { stripEmoji } from '@/lib/emoji'
