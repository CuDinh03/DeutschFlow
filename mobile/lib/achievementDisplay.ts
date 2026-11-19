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

// Quét theo code point thay vì regex \p{...} (cùng lý do với stripLeadingEmoji ở notificationsApi).
function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1ffff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    (cp >= 0x2300 && cp <= 0x23ff) ||
    cp === 0xfe0f ||
    cp === 0x200d ||
    cp === 0x20e3
  )
}

/** Bỏ mọi emoji trong chuỗi rồi gộp khoảng trắng. Chuỗi chỉ toàn emoji thì trả chuỗi rỗng. */
export function stripEmoji(text: string | null | undefined): string {
  if (!text) return ''
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp != null && isEmojiCodePoint(cp)) continue
    out += ch
  }
  return out.replace(/\s+/g, ' ').trim()
}
