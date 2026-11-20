// Bỏ emoji khỏi chữ máy chủ gửi (tên huy hiệu, thông báo) — mobile không hiện emoji (GALERIE_GLYPHS.md).
// Thuần, không import: dùng được ở cả `notificationsApi` (module thuần) lẫn màn hình.

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

/**
 * Bỏ mọi emoji trong chuỗi (kèm khoảng trắng ngay trước emoji, để `"Người ôn tập 📚"!` thành
 * `"Người ôn tập"!`) rồi gộp khoảng trắng. Chuỗi chỉ toàn emoji thì trả chuỗi rỗng. Dùng cho tên huy hiệu
 * và chữ thông báo máy chủ gửi (mobile không hiện emoji — GALERIE_GLYPHS.md).
 */
export function stripEmoji(text: string | null | undefined): string {
  if (!text) return ''
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp != null && isEmojiCodePoint(cp)) {
      out = out.replace(/[ \t]+$/, '')
      continue
    }
    out += ch
  }
  return out.replace(/\s+/g, ' ').trim()
}
