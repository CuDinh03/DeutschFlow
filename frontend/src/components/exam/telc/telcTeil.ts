/**
 * Bốn dạng bài riêng của đề telc và các phép thuần tính kèm theo.
 *
 * Trình chạy đề hiện suy dạng widget từ HÌNH DẠNG câu hỏi (`answerWidget`): có `options` thì là
 * trắc nghiệm, `correct` một ký tự thì là ghép nối. Cách đó không đủ cho telc:
 *
 * - `GAP_WORDBANK` có `correct` một chữ cái nên sẽ ra nhầm bộ nút ghép nối `A–H`, trong khi đáp án
 *   phải chọn từ **hộp 15 từ dùng chung cả Teil** và mỗi từ chỉ dùng một lần.
 * - `MATCH_HEADLINE` cần 10 tiêu đề `a–j`, `MATCH_AD_X` cần 12 mẩu `a–l` **cộng `x`** — nhiều hơn
 *   8 lựa chọn mà bộ nút cũ đóng cứng.
 *
 * Nên dạng bài telc đọc từ `teil.type` (khoá cấp Teil, `ExamQuestionSanitizer` không đụng tới) chứ
 * không suy từ câu hỏi. Kho lựa chọn cũng nằm ở cấp Teil vì **cả Teil dùng chung một kho**.
 */

import type { ExamQuestionItem, ExamTeil } from '@/app/v2/student/mock-exam/run/ExamTaking'

export const TELC_TEIL_TYPES = ['MATCH_HEADLINE', 'MATCH_AD_X', 'GAP_MC', 'GAP_WORDBANK'] as const
export type TelcTeilType = (typeof TELC_TEIL_TYPES)[number]

/** Đáp án "không mẩu rao vặt nào hợp" của Leseverstehen Teil 3 — dùng lại được, khác mọi chữ cái. */
export const NONE_OF_THEM = 'x'

export interface TelcTeil extends ExamTeil {
  type?: string
  /** Kho lựa chọn dùng chung cả Teil: tiêu đề `a–j`, mẩu rao vặt `a–l`, hoặc hộp từ `a–o`. */
  headlines?: Record<string, string>
  ads?: Record<string, string>
  word_bank?: Record<string, string>
  /** Văn bản có ô trống đánh số, đánh dấu bằng `___21___`. */
  gapped_text?: string
  /** Mỗi lựa chọn chỉ dùng một lần (mặc định BẬT cho cả bốn dạng telc). */
  single_use?: boolean
  /** Teil 3 Leseverstehen: cho thêm đáp án `x`. */
  allow_none?: boolean
}

export function telcTeilType(teil: ExamTeil | TelcTeil): TelcTeilType | null {
  const raw = (teil as TelcTeil).type
  return TELC_TEIL_TYPES.includes(raw as TelcTeilType) ? (raw as TelcTeilType) : null
}

/**
 * Kho lựa chọn của Teil, theo đúng thứ tự chữ cái để học viên đối chiếu được với đề giấy.
 * Rỗng nghĩa là seed thiếu kho — nơi gọi phải báo ra chứ đừng vẽ một Teil không bấm được.
 */
export function telcOptionPool(teil: TelcTeil): { key: string; label: string }[] {
  const source = teil.headlines ?? teil.ads ?? teil.word_bank
  if (!source) return []
  return Object.entries(source)
    .map(([key, label]) => ({ key, label: String(label) }))
    .sort((a, b) => a.key.localeCompare(b.key, 'de'))
}

/**
 * Các lựa chọn đã bị câu KHÁC chiếm mất. `x` không bao giờ bị khoá: nhiều tình huống cùng có thể
 * "không mẩu nào hợp". Teil khai `single_use: false` thì không khoá gì.
 */
export function telcUsedKeys(
  teil: TelcTeil,
  items: ExamQuestionItem[],
  answers: Record<string, string>,
  exceptItemId?: string,
): Set<string> {
  if (teil.single_use === false) return new Set()
  const used = new Set<string>()
  for (const item of items) {
    if (!item.id || item.id === exceptItemId) continue
    const picked = answers[item.id]
    if (picked && picked !== NONE_OF_THEM) used.add(picked)
  }
  return used
}

export type GapSegment = { kind: 'text'; value: string } | { kind: 'gap'; gap: number }

/**
 * Cắt văn bản có ô trống thành các mảnh để dựng. Ô trống viết là `___21___` (ba gạch dưới trở lên
 * ở mỗi bên). Văn bản không có ô trống nào trả về đúng một mảnh chữ — người gọi vẫn dựng được.
 */
export function parseGappedText(text: string): GapSegment[] {
  const segments: GapSegment[] = []
  const pattern = /_{3,}\s*(\d+)\s*_{3,}/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ kind: 'text', value: text.slice(cursor, match.index) })
    segments.push({ kind: 'gap', gap: Number(match[1]) })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) })
  return segments
}

/**
 * Số ô trống của một câu: ưu tiên khoá `gap` khai tường minh, sau đó là cụm số cuối trong `id`
 * (`SB2-31` ⇒ 31) — seed hiện đánh số câu theo đúng số ô của đề thật.
 */
export function itemGapNumber(item: ExamQuestionItem & { gap?: number }): number | null {
  if (typeof item.gap === 'number') return item.gap
  const tail = /(\d+)\s*$/.exec(item.id ?? '')
  return tail ? Number(tail[1]) : null
}

/** Tra câu hỏi theo số ô trống, để mảnh `___21___` biết mình thuộc câu nào. */
export function itemsByGap(items: ExamQuestionItem[]): Map<number, ExamQuestionItem> {
  const map = new Map<number, ExamQuestionItem>()
  for (const item of items) {
    const gap = itemGapNumber(item)
    if (gap !== null && !map.has(gap)) map.set(gap, item)
  }
  return map
}
