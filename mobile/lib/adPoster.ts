// Mẩu rao vặt telc Lesen Teil 3 (ghép tình huống ↔ mẩu tin) dựng như tờ dán trên bảng tin (mẫu v3.4
// `lesen3`, Đợt 7a, 19/11/2026): sáu kiểu thẻ luân phiên để mắt phân biệt các mẩu như đề giấy.
// Logic thuần — không import component.

export type AdStyle = 'rahmen' | 'hand' | 'band' | 'grau' | 'plakat' | 'pixel'

export const AD_STYLES: readonly AdStyle[] = ['rahmen', 'hand', 'band', 'grau', 'plakat', 'pixel']

/** Kiểu thẻ theo vị trí mẩu tin (luân phiên, ổn định giữa các lần dựng). */
export function adStyleAt(index: number): AdStyle {
  const n = AD_STYLES.length
  return AD_STYLES[((index % n) + n) % n]
}

/**
 * Tách mẩu tin thành dòng tiêu đề + phần thân: xuống dòng thì dòng đầu là tiêu đề; không thì câu đầu
 * (kết thúc bằng . ! ? :) nếu ngắn (≤ 48 ký tự) và còn phần sau. Không tách được thì cả mẩu là thân.
 */
export function splitAd(label: string): { headline: string | null; body: string } {
  const text = label.trim()
  const nl = text.indexOf('\n')
  if (nl > 0) {
    const head = text.slice(0, nl).trim()
    const rest = text.slice(nl + 1).trim()
    return rest ? { headline: head, body: rest } : { headline: null, body: head }
  }
  const m = /^(.{3,48}?[.!?:])\s+(\S[\s\S]*)$/.exec(text)
  if (m) return { headline: m[1].trim(), body: m[2].trim() }
  return { headline: null, body: text }
}
