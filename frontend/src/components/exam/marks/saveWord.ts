/**
 * Lưu từ từ bài đọc (13/11/2026) — hàm thuần, khớp kiểm tra phía server (`SavedWordText`).
 */

export const MAX_SAVE_WORDS = 5
const MAX_SURFACE = 60
const MAX_SENTENCE = 500

// tsconfig nhắm ES5 nên không viết được regex cờ `u` dạng literal; trình duyệt nào chạy app cũng có \p{L}.
const WORD = new RegExp("^\\p{L}[\\p{L}\\-'’]*$", 'u')
const LEAD = new RegExp('^[^\\p{L}]+', 'u')
const TRAIL = new RegExp('[^\\p{L}]+$', 'u')

/** Bỏ dấu câu / số ở hai đầu, gộp khoảng trắng. Trả `null` nếu không phải 1–5 từ tiếng Đức liền nhau. */
export function saveableText(raw: string): string | null {
  const s = raw
    .replace(/[\s ]+/g, ' ')
    .trim()
    .replace(LEAD, '')
    .replace(TRAIL, '')
  if (!s || s.length > MAX_SURFACE) return null
  const words = s.split(' ')
  if (words.length > MAX_SAVE_WORDS) return null
  return words.every((w) => WORD.test(w)) ? s : null
}

/**
 * Câu chứa đoạn [s, e) trong chữ của một khối: lùi tới dấu kết câu gần nhất phía trước, tiến tới dấu kết câu
 * phía sau. Xuống dòng KHÔNG tính là hết câu — bài telc có `context_lines` ngắt theo dòng in, câu vắt qua
 * nhiều dòng. Dài quá thì cắt quanh chữ đã chọn.
 */
export function sentenceAround(text: string, s: number, e: number): string | null {
  if (!text || s < 0 || e > text.length || e <= s) return null
  const isEnd = (ch: string) => ch === '.' || ch === '!' || ch === '?'
  let a = s
  while (a > 0 && !isEnd(text[a - 1])) a--
  let b = e
  while (b < text.length && !isEnd(text[b])) b++
  if (b < text.length) b++ // giữ dấu kết câu
  let out = text.slice(a, b).replace(/[\s ]+/g, ' ').trim()
  if (out.length > MAX_SENTENCE) {
    const mid = Math.floor((s + e) / 2) - a
    const from = Math.max(0, Math.min(out.length - MAX_SENTENCE, mid - MAX_SENTENCE / 2))
    out = out.slice(from, from + MAX_SENTENCE).trim()
  }
  return out || null
}
