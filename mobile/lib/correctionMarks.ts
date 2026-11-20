// Tô chỗ sai / chỗ sửa trong câu (phiếu sửa câu kiểu giấy bài làm, giao diện v3.4 Đợt 5, mẫu `feedback`).
// Backend trả `errors[]` (`wrongSpan` → `correctedSpan`); hàm ở đây cắt câu thành đoạn thường và đoạn được
// đánh dấu. Đoạn không tìm thấy (LLM chép lệch) thì bỏ qua, câu vẫn hiện nguyên — không bao giờ mất chữ.

import type { SpeakingErrorItem } from '@/lib/speakingApi'

export interface MarkSegment {
  text: string
  /** Số thứ tự lỗi (1, 2…) nếu đoạn này được đánh dấu. */
  mark: number | null
}

/**
 * Cắt `text` theo các đoạn cần đánh dấu (theo thứ tự lỗi). Mỗi đoạn lấy lần xuất hiện đầu tiên chưa bị
 * đoạn trước chiếm (so khớp phân biệt hoa thường trước, rồi không phân biệt); đoạn chồng lấn bị bỏ.
 */
export function markSegments(text: string, spans: readonly (string | null | undefined)[]): MarkSegment[] {
  const ranges: { start: number; end: number; mark: number }[] = []
  const lower = text.toLowerCase()
  spans.forEach((raw, i) => {
    const span = raw?.trim()
    if (!span) return
    const overlaps = (start: number) => ranges.some((r) => start < r.end && start + span.length > r.start)
    const find = (hay: string, needle: string) => {
      let from = 0
      for (;;) {
        const at = hay.indexOf(needle, from)
        if (at < 0) return -1
        if (!overlaps(at)) return at
        from = at + 1
      }
    }
    let at = find(text, span)
    if (at < 0) at = find(lower, span.toLowerCase())
    if (at >= 0) ranges.push({ start: at, end: at + span.length, mark: i + 1 })
  })
  ranges.sort((a, b) => a.start - b.start)
  const out: MarkSegment[] = []
  let pos = 0
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), mark: null })
    out.push({ text: text.slice(r.start, r.end), mark: r.mark })
    pos = r.end
  }
  if (pos < text.length || out.length === 0) out.push({ text: text.slice(pos), mark: null })
  return out
}

/** Lỗi dùng được để hiện trên phiếu: có đoạn sai và đoạn đúng khác nhau. */
export function usableErrors(errors: readonly SpeakingErrorItem[] | null | undefined): SpeakingErrorItem[] {
  return (errors ?? []).filter((e) => {
    const wrong = e.wrongSpan?.trim()
    const right = e.correctedSpan?.trim()
    return !!wrong && !!right && wrong !== right
  })
}
