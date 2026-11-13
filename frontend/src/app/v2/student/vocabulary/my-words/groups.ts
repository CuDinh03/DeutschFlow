import type { SavedWord } from '@/lib/myWordsApi'

export type GroupBy = 'topic' | 'passage'

export interface WordGroup {
  key: string
  /** `null` = nhóm "chưa phân loại" / "không rõ bài" — trang tự đặt nhãn. */
  label: string | null
  /** Dòng phụ: Teil của nhóm theo bài. */
  sub: string | null
  words: SavedWord[]
}

/** `LESEN-2` ⇒ `Lesen 2`, `SPRACHBAUSTEINE-1` ⇒ `Sprachbausteine 1`, `HOEREN-3` ⇒ `Hören 3`. */
export function teilLabel(key: string | null): string | null {
  if (!key) return null
  const m = /^([A-Z_]+)-(\d+)$/.exec(key)
  if (!m) return key
  const name = m[1] === 'HOEREN' ? 'Hören' : m[1].charAt(0) + m[1].slice(1).toLowerCase()
  return `${name} ${m[2]}`
}

const byLabel = (a: WordGroup, b: WordGroup) => {
  if (a.label == null) return 1
  if (b.label == null) return -1
  return a.label.localeCompare(b.label)
}

/**
 * Theo chủ đề: nhóm xếp theo nhãn, "chưa phân loại" cuối. Theo bài đọc: mỗi đề × Teil một nhóm, bài lưu gần
 * nhất lên đầu, từ không rõ bài cuối. Trong nhóm giữ thứ tự server (mới nhất trước).
 */
export function groupWords(words: readonly SavedWord[], by: GroupBy): WordGroup[] {
  const map = new Map<string, WordGroup>()
  for (const w of words) {
    const key =
      by === 'topic'
        ? w.topic ?? '__none'
        : w.examId != null ? `${w.examId}:${w.teilKey ?? ''}` : '__none'
    let g = map.get(key)
    if (!g) {
      g =
        by === 'topic'
          ? { key, label: w.topic ? w.topicLabel ?? w.topic : null, sub: null, words: [] }
          : { key, label: w.examId != null ? w.examTitle ?? `#${w.examId}` : null, sub: teilLabel(w.teilKey), words: [] }
      map.set(key, g)
    }
    g.words.push(w)
  }
  const groups = Array.from(map.values())
  if (by === 'topic') return groups.sort(byLabel)
  // Map giữ thứ tự gặp đầu tiên = từ mới nhất của nhóm (server trả mới nhất trước) ⇒ chỉ đẩy "không rõ bài" xuống.
  return groups.filter((g) => g.label != null).concat(groups.filter((g) => g.label == null))
}

/** Lọc theo chữ gõ: dạng gốc, chữ đã bôi, nghĩa (không phân biệt hoa thường). */
export function filterWords(words: readonly SavedWord[], q: string): SavedWord[] {
  const s = q.trim().toLowerCase()
  if (!s) return words.slice()
  return words.filter((w) =>
    [w.lemma, w.surface, w.meaning ?? ''].some((x) => x.toLowerCase().includes(s)),
  )
}
