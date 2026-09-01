/**
 * Đọc + chấm các mục bài tập nhúng trong `content_json` của node cây học tập.
 *
 * QA 2026-09-02 (F-21). `GrammarView`/`ReadingView` chấm bằng `item.answerIndex`, nhưng nội dung
 * thật trong migration dùng khoá **`correct`**: đếm toàn bộ migration được `correct` 406 lần,
 * `answerIndex` đúng 2 lần. `item.answerIndex` vì thế là `undefined`, còn lựa chọn của người học là
 * số ⇒ hai vế không bao giờ bằng nhau ⇒ điểm luôn 0 ⇒ người học chọn ĐÚNG hết vẫn nhận
 * "Bạn trả lời đúng 0/N. Cần đúng 100% để qua bài!" và không tài nào qua được node.
 *
 * Luật ở đây phản chiếu HAI nguồn đã có sẵn, không tự nghĩ mới:
 *   · `NodeExerciseGrader` (backend, chấm quyết định) — cùng cách chuẩn hoá chuỗi và cùng answer key;
 *   · `mobile/lib/skillTreeApi.ts` (`normalizeAnswer` / `isFillCorrect`) — bản client đang chạy đúng.
 * Ba nơi lệch nhau là điểm client hiện lên khác điểm máy chủ ghi, nên khi sửa phải sửa cả ba.
 */

export interface NodeExerciseItem {
  id?: string
  type?: string
  question?: string
  question_vi?: string
  question_de?: string
  options?: string[]
  /** Khoá đáp án thật của nội dung. */
  correct?: number
  /** Khoá cũ, chỉ còn 2 mục trong toàn bộ migration — giữ để không làm hỏng chúng. */
  answerIndex?: number
  answer?: string
  accept_also?: string[]
  sentence_de?: string
  hint_vi?: string
}

/** Đáp án thô gửi lên `POST /skill-tree/{nodeId}/submit`, đúng shape backend đọc. */
export type ItemAnswer = { choice: number } | { text: string }

export const MULTIPLE_CHOICE = 'MULTIPLE_CHOICE'
export const FILL_BLANK = 'FILL_BLANK'

/**
 * Danh sách bài tập của một node: `theory_gate` TRƯỚC rồi `practice`, đúng thứ tự
 * `NodeExerciseGrader.extractExercises` và `mobile/app/(student)/node-practice.tsx`.
 *
 * Web trước đây chỉ đọc `practice` và bỏ hẳn `theory_gate` (159 lần trong migration). Backend thì
 * chấm cả hai, nên nộp thiếu `theory_gate` là tự kéo điểm xuống dưới ngưỡng và node không bao giờ
 * hoàn thành — kể cả khi người học trả lời đúng mọi câu web có hiện ra.
 */
export function collectExercises(exercises: unknown): NodeExerciseItem[] {
  const ex = (exercises ?? {}) as { theory_gate?: unknown; practice?: unknown }
  const gate = Array.isArray(ex.theory_gate) ? ex.theory_gate : []
  const practice = Array.isArray(ex.practice) ? ex.practice : []
  return [...gate, ...practice].filter(
    (e): e is NodeExerciseItem => !!e && typeof e === 'object' && !!(e as NodeExerciseItem).type,
  )
}

/** Câu hỏi hiển thị. Nội dung thật phần lớn nằm ở `question_vi` (338) chứ không phải `question` (184). */
export function questionTextOf(item: NodeExerciseItem): string | null {
  return item.question?.trim() || item.question_vi?.trim() || item.question_de?.trim() || null
}

/** Chỉ số đáp án đúng: `correct` là khoá thật, `answerIndex` chỉ là bản cũ còn sót. */
export function correctIndexOf(item: NodeExerciseItem): number | null {
  if (typeof item.correct === 'number') return item.correct
  if (typeof item.answerIndex === 'number') return item.answerIndex
  return null
}

/** Mục có thể chấm quyết định — phải khớp `NodeExerciseGrader.countScored` (cần cả `id`). */
export function isScored(item: NodeExerciseItem): boolean {
  return !!item.id && (item.type === MULTIPLE_CHOICE || item.type === FILL_BLANK)
}

/** Trim, hạ chữ thường, bỏ `.,!?;:`, gộp khoảng trắng — y hệt backend và mobile. */
export function normalizeAnswer(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
}

export function isFillCorrect(input: string, item: NodeExerciseItem): boolean {
  const n = normalizeAnswer(input)
  if (!n) return false
  if (normalizeAnswer(item.answer ?? '') === n) return true
  return (item.accept_also ?? []).some((alt) => normalizeAnswer(alt) === n)
}

/** Đáp án người học nhập, khoá theo VỊ TRÍ trong danh sách (state sẵn có của các view). */
export type AnswerMap = Record<number, number | string | undefined>

export interface GradeResult {
  /** Số mục chấm được. */
  scored: number
  correct: number
  /** 0–100; bằng 0 khi không có mục nào chấm được (người gọi tự quyết nghĩa của ca đó). */
  percent: number
}

export function gradeItems(items: NodeExerciseItem[], answers: AnswerMap): GradeResult {
  let scored = 0
  let correct = 0
  items.forEach((item, i) => {
    if (!isScored(item)) return
    scored++
    const given = answers[i]
    if (item.type === MULTIPLE_CHOICE) {
      const key = correctIndexOf(item)
      if (typeof given === 'number' && key !== null && given === key) correct++
    } else if (typeof given === 'string' && isFillCorrect(given, item)) {
      correct++
    }
  })
  return { scored, correct, percent: scored === 0 ? 0 : Math.round((correct * 100) / scored) }
}

/**
 * Dựng `item_answers` cho `POST /skill-tree/{nodeId}/submit` — khoá theo `id` của mục, đúng thứ
 * backend tra. Mục chưa trả lời vẫn được gửi (chuỗi rỗng / -1) để máy chủ tính đúng mẫu số thay vì
 * âm thầm bỏ qua.
 */
export function buildItemAnswers(items: NodeExerciseItem[], answers: AnswerMap): Record<string, ItemAnswer> {
  const out: Record<string, ItemAnswer> = {}
  items.forEach((item, i) => {
    if (!isScored(item) || !item.id) return
    const given = answers[i]
    out[item.id] =
      item.type === MULTIPLE_CHOICE
        ? { choice: typeof given === 'number' ? given : -1 }
        : { text: typeof given === 'string' ? given : '' }
  })
  return out
}
