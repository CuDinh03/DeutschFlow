/**
 * Sổ từ riêng của học viên (13/11/2026) — `/api/my-words`. Lưu từ khi luyện đề đọc; lưu xong tự vào lịch ôn.
 * `locale` chỉ đổi nhãn chủ đề trả về (vi / en có bản dịch, de dùng tên gốc).
 */
import api from '@/lib/api'

export interface SaveWordRequest {
  /** Chữ bôi đen, 1–5 từ. */
  text: string
  /** Câu chứa chữ đó — để tra đúng nghĩa và làm ví dụ cho thẻ ôn. */
  sentence: string | null
  examId: number | null
  /** Xem lại lượt thi thử đã nộp — server lấy đề từ lượt (lượt chưa nộp ⇒ 409). */
  attemptId?: number | null
  teilKey: string | null
  /** Khối chữ trong bài (`ctx`, `q:<id>`) và vị trí — để sau mở lại đúng chỗ. */
  block: string | null
  start: number | null
  end: number | null
}

export interface SavedWord {
  id: number
  lemma: string
  article: string | null
  pos: string | null
  meaning: string | null
  /** Tên chủ đề gốc (tiếng Đức) — `null` = chưa phân loại. */
  topic: string | null
  /** Tên chủ đề theo ngôn ngữ giao diện. */
  topicLabel: string | null
  surface: string
  sentence: string | null
  examId: number | null
  examTitle: string | null
  teilKey: string | null
  block: string | null
  start: number | null
  end: number | null
  createdAt: string
  /** Từ đã có trong sổ từ trước. */
  alreadySaved: boolean
}

export interface SavedWordList {
  items: SavedWord[]
  total: number
}

export interface WordTopic {
  name: string
  label: string
}

const q = (locale?: string) => (locale ? { params: { locale } } : undefined)

export const myWordsApi = {
  save: (req: SaveWordRequest, locale?: string) => api.post<SavedWord>('/my-words', req, q(locale)).then((r) => r.data),
  list: (locale?: string) => api.get<SavedWordList>('/my-words', q(locale)).then((r) => r.data),
  topics: (locale?: string) => api.get<WordTopic[]>('/my-words/topics', q(locale)).then((r) => r.data),
  setTopic: (id: number, topic: string | null, locale?: string) =>
    api.put<SavedWord>(`/my-words/${id}/topic`, { topic }, q(locale)).then((r) => r.data),
  setMeaning: (id: number, meaning: string, locale?: string) =>
    api.put<SavedWord>(`/my-words/${id}/meaning`, { meaning }, q(locale)).then((r) => r.data),
  remove: (id: number) => api.delete(`/my-words/${id}`).then(() => undefined),
}

/**
 * Đường mở lại đúng chỗ đã lưu trong bài luyện: `at=<khối>:<đầu>:<cuối>` + `w=<chữ bôi>` để trang luyện kiểm
 * chữ còn khớp (đề có thể đã sửa). Không có đề / Teil ⇒ `null`.
 */
export function passageHref(w: Pick<SavedWord, 'examId' | 'teilKey' | 'block' | 'start' | 'end' | 'surface'>): string | null {
  if (w.examId == null || !w.teilKey) return null
  const p = new URLSearchParams({ examId: String(w.examId), teil: w.teilKey })
  if (w.block && w.start != null && w.end != null) {
    p.set('at', `${w.block}:${w.start}:${w.end}`)
    p.set('w', w.surface)
  }
  return `/v2/student/mock-exam/practice/teil?${p.toString()}`
}
