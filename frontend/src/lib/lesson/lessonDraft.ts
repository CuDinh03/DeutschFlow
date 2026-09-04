/**
 * lessonDraft — bản nháp bài luyện lưu TRÊN THIẾT BỊ (S-04 AC-2 / B-17).
 *
 * **Đo trước khi viết**, đúng cách B-13 đã làm với engine thi: trong runner luyện kỹ năng, trả lời
 * 2/3 câu rồi tải lại trang thì còn **0** — `answers` chỉ nằm trong `useState`, không `localStorage`,
 * không `beforeunload`. Điều hướng đi rồi quay lại cũng mất sạch. Đây là cùng một họ lỗi mất-trắng,
 * chỉ khác bề mặt.
 *
 * PHẠM VI PHẢI NÓI ĐÚNG: đây là `localStorage` của MỘT trình duyệt. Đổi máy, đổi trình duyệt hay
 * xoá dữ liệu site là không còn. UI tuyệt đối không được nói "Đã lưu" trống không — phải nói rõ
 * "trên thiết bị này" (ràng buộc S-14, y như nhãn của bài thi ở B-14).
 *
 * `generation` là phần khác biệt so với `examDraft`: một kỹ năng có thể sinh **thế hệ đề mới**
 * (`POST …/{SKILL}/next`). Khôi phục đáp án của thế hệ 1 lên đề của thế hệ 2 sẽ đánh dấu đúng
 * những câu người học chưa hề trả lời — nên nháp lệch thế hệ bị coi như không có.
 */

const KEY_PREFIX = 'df.lesson.draft.v1.'

/** Nháp quá hạn lâu thì dọn — không giữ rác vô thời hạn trong storage của người dùng. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

export interface LessonAnswer {
  answer: number | string
  correct: boolean
}

export interface LessonDraft {
  scope: string
  /** Thế hệ đề. Nháp lệch thế hệ là nháp của một bộ câu hỏi KHÁC. */
  generation: number
  /** Chỉ số câu (dạng chuỗi, vì JSON không có khoá số) → đáp án đã chọn. */
  answers: Record<string, LessonAnswer>
  /** Epoch ms của lần ghi gần nhất — để nói đúng "đã lưu lúc nào". */
  savedAt: number
}

/** Khoá phạm vi cho runner luyện: một node · một kỹ năng · một session. */
export function practiceScope(nodeId: number, skill: string, sessionId: number): string {
  return `practice.${nodeId}.${skill}.${sessionId}`
}

/**
 * `localStorage` có thể NÉM ngay ở bước truy cập (Safari private mode, site data bị chặn), chứ
 * không chỉ ở bước ghi — nên mọi lối vào đều bọc try/catch, kể cả phép đọc `window.localStorage`.
 */
function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function key(scope: string): string {
  return `${KEY_PREFIX}${scope}`
}

function parseAnswers(raw: unknown): Record<string, LessonAnswer> {
  const out: Record<string, LessonAnswer> = {}
  if (typeof raw !== 'object' || raw === null) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue
    const entry = v as Partial<LessonAnswer>
    const answerOk = typeof entry.answer === 'number' || typeof entry.answer === 'string'
    if (!answerOk || typeof entry.correct !== 'boolean') continue
    out[k] = { answer: entry.answer as number | string, correct: entry.correct }
  }
  return out
}

/**
 * Đọc nháp của một phạm vi. Trả `null` khi không có, hỏng, lệch phạm vi, hoặc **lệch thế hệ đề**.
 * Từng đáp án sai hình dạng bị bỏ riêng lẻ thay vì vứt cả bản nháp — mất một câu vẫn hơn mất bài.
 */
export function readLessonDraft(scope: string, generation: number): LessonDraft | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LessonDraft>
    if (
      parsed?.scope !== scope ||
      typeof parsed.generation !== 'number' ||
      parsed.generation !== generation ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null
    }
    return {
      scope,
      generation,
      answers: parseAnswers(parsed.answers),
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

/** Ghi nháp. Trả `false` khi storage không dùng được — caller PHẢI nói thật điều đó với người học. */
export function writeLessonDraft(draft: LessonDraft): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(key(draft.scope), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

/** Xoá nháp — gọi sau khi nộp thành công, để lần luyện sau không nhặt lại bài cũ. */
export function clearLessonDraft(scope: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(key(scope))
  } catch {
    /* storage không dùng được thì cũng không có gì để xoá */
  }
}

/** Dọn nháp quá hạn. Chỉ đụng khoá mang tiền tố của chính module này. */
export function pruneStaleLessonDrafts(now: number): number {
  const store = storage()
  if (!store) return 0
  let removed = 0
  try {
    // Gom key trước rồi mới xoá: xoá trong lúc duyệt theo chỉ số sẽ làm lệch chỉ số và bỏ sót.
    const keys: string[] = []
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i)
      if (k?.startsWith(KEY_PREFIX)) keys.push(k)
    }
    for (const k of keys) {
      try {
        const parsed = JSON.parse(store.getItem(k) ?? 'null') as Partial<LessonDraft> | null
        const stamp = typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0
        if (now - stamp > STALE_AFTER_MS) {
          store.removeItem(k)
          removed += 1
        }
      } catch {
        store.removeItem(k) // nháp hỏng cũng là rác
        removed += 1
      }
    }
  } catch {
    return removed
  }
  return removed
}
