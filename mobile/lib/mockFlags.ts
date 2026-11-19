// Danh sách "Câu đánh dấu (N)" của màn đang thi thử (Đợt 4e, 20/11/2026) — như web `FlaggedNav`: chỉ các
// câu của chặng đang thi (chặng trước đã khoá), bấm một câu để tới câu đó. Hàm thuần.

import { teilName } from './mockResult'

export interface FlagSection {
  name: string
  groups: readonly { teilNo?: number; items: readonly { id: string; gap?: number; question: string }[] }[]
}

export interface FlaggedEntry {
  id: string
  /** "Lesen Teil 3". */
  teil: string
  /** "Câu 18", "Ô trống 34", hoặc đầu câu hỏi. */
  label: string
}

const QUESTION_PREVIEW = 32

/** Nhãn ngắn của một câu: số câu như trên đề nếu id là số, không thì số ô trống, không thì đầu câu hỏi. */
export function itemShortLabel(item: { id: string; gap?: number; question: string }): string {
  if (/^\d+$/.test(item.id)) return `Câu ${item.id}`
  if (item.gap != null) return `Ô trống ${item.gap}`
  const q = item.question.trim()
  return q.length > QUESTION_PREVIEW ? `${q.slice(0, QUESTION_PREVIEW - 1)}…` : q
}

/** Câu đã đánh dấu trong các phần đang hiện, theo thứ tự đề. */
export function flaggedEntries(sections: readonly FlagSection[], flags: readonly string[]): FlaggedEntry[] {
  const set = new Set(flags)
  const out: FlaggedEntry[] = []
  for (const sec of sections) {
    sec.groups.forEach((g, gi) => {
      for (const it of g.items) {
        if (set.has(it.id)) out.push({ id: it.id, teil: teilName(sec.name, g.teilNo ?? gi + 1), label: itemShortLabel(it) })
      }
    })
  }
  return out
}
