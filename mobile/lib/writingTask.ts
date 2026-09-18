/**
 * Phần Viết kiểu đề telc trên app (17/09/2026) — sinh đôi bản web
 * `frontend/src/components/exam/telc/writingTask.ts`: văn bản kích thích và thứ tự in Leitpunkte.
 *
 * Đề thật in nguyên văn E-Mail của bạn phía trên, rồi bốn Leitpunkte XÁO thứ tự (Anweisung đòi
 * „eine passende Reihenfolge", chấm ở Kriterium II). Seed lưu thứ tự hợp lý cho AI chấm; app xáo
 * khi in bằng hạt giống từ chính nội dung — cùng một đề luôn ra cùng một thứ tự, như tờ đề in.
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

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

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

/** Thứ tự in Leitpunkte: không khai cờ thì giữ nguyên; xáo trùng thứ tự gốc thì xoay một bước. */
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
