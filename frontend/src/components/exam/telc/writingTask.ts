/**
 * Phần Viết kiểu đề telc (17/09/2026): văn bản kích thích và thứ tự in các Leitpunkte.
 *
 * Đề thật in nguyên văn E-Mail của bạn (hoặc mẩu tin / thư) phía trên, rồi bốn Leitpunkte
 * **xáo thứ tự** — Anweisung đòi thí sinh „eine passende Reihenfolge" và thứ tự đó được chấm ở
 * Kriterium II. Seed lưu Leitpunkte theo thứ tự hợp lý (AI chấm cần biết), còn trình chạy xáo khi
 * in. Xáo bằng hạt giống lấy từ chính nội dung: cùng một đề luôn ra cùng một thứ tự — như tờ đề
 * in — và không nhảy lung tung giữa hai lần vẽ lại màn hình.
 */

export type WritingStimulusType = 'EMAIL' | 'AD' | 'LETTER'

export interface WritingStimulus {
  type?: WritingStimulusType | string
  from?: string
  subject?: string
  body: string
}

export function isWritingStimulus(value: unknown): value is WritingStimulus {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WritingStimulus).body === 'string' &&
    (value as WritingStimulus).body.trim().length > 0
  )
}

/** Băm FNV-1a 32 bit — đủ để làm hạt giống ổn định, không cần mật mã. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** mulberry32 — sinh số giả ngẫu nhiên xác định theo hạt giống. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Thứ tự in các Leitpunkte. `shuffle` tắt (đề Goethe không khai) thì giữ nguyên. Bật thì xáo theo
 * hạt giống từ nội dung; nếu xáo ra đúng thứ tự gốc thì xoay một bước — in „xáo" mà trùng thứ tự
 * hợp lý là vô nghĩa với đề có hai ý trở lên.
 */
export function orderedWritingPoints(points: readonly string[], shuffle: boolean | undefined): string[] {
  const out = [...points]
  if (!shuffle || out.length < 2) return out
  const random = mulberry32(fnv1a(points.join('')))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  const unchanged = out.every((p, i) => p === points[i])
  return unchanged ? [...out.slice(1), out[0]] : out
}
