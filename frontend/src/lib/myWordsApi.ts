/**
 * Sổ từ riêng của học viên (13/11/2026) — `/api/my-words`. Lưu từ khi luyện đề đọc; lưu xong tự vào lịch ôn.
 */
import api from '@/lib/api'

export interface SaveWordRequest {
  /** Chữ bôi đen, 1–5 từ. */
  text: string
  /** Câu chứa chữ đó — để tra đúng nghĩa và làm ví dụ cho thẻ ôn. */
  sentence: string | null
  examId: number | null
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
  createdAt: string
  /** Từ đã có trong sổ từ trước. */
  alreadySaved: boolean
}

export interface SavedWordList {
  items: SavedWord[]
  total: number
}

export const myWordsApi = {
  save: (req: SaveWordRequest) => api.post<SavedWord>('/my-words', req).then((r) => r.data),
  list: () => api.get<SavedWordList>('/my-words').then((r) => r.data),
  remove: (id: number) => api.delete(`/my-words/${id}`).then(() => undefined),
}
