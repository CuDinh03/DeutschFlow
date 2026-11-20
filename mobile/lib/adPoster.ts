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
  const r = splitAdRanges(label)
  return { headline: r.headline ? label.slice(r.headline[0], r.headline[1]) : null, body: label.slice(r.body[0], r.body[1]) }
}

/** Bỏ khoảng trắng hai đầu của `[s, e)`. */
function trimRange(text: string, s: number, e: number): [number, number] {
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  return [s, e]
}

/**
 * Như `splitAd` nhưng trả VỊ TRÍ `[s, e)` trên chính chuỗi đưa vào — để vẽ tiêu đề / thân qua lớp bút đánh
 * dấu (khối `ad:<k>`, Đợt 4f) mà vẫn đúng vị trí ký tự server kiểm.
 */
export function splitAdRanges(label: string): { headline: [number, number] | null; body: [number, number] } {
  const [ts, te] = trimRange(label, 0, label.length)
  const nl = label.indexOf('\n', ts)
  if (nl > ts && nl < te) {
    const head = trimRange(label, ts, nl)
    const rest = trimRange(label, nl + 1, te)
    return rest[1] > rest[0] ? { headline: head, body: rest } : { headline: null, body: head }
  }
  const text = label.slice(ts, te)
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
    return { headline: trimRange(label, ts, ts + end), body: trimRange(label, ts + end, te) }
  }
  return { headline: null, body: [ts, te] }
}
