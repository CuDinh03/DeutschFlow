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
  // Tìm dấu kết câu đầu tiên trong 48 ký tự; dấu chấm ngay sau từ ngắn (≤ 3 chữ: "Tel.", "Dr.", "Nr.",
  // "z.B.") là chữ viết tắt, không phải hết câu ⇒ bỏ qua và tìm tiếp.
  const re = /[.!?:](?=\s+\S)/g
  let hit: RegExpExecArray | null
  while ((hit = re.exec(text)) && hit.index < 48) {
    const end = hit.index + 1
    if (hit[0] === '.') {
      const word = /(\S+)$/.exec(text.slice(0, hit.index))?.[1] ?? ''
      if (word.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length <= 3) continue
    }
    if (end < 3) continue
    return { headline: text.slice(0, end).trim(), body: text.slice(end).trim() }
  }
  return { headline: null, body: text }
}
