import api from '@/lib/api'

/**
 * practiceApi — thư viện bài tập bổ trợ (`/api/practice/catalog`).
 *
 * A3 (09/11/2026): web KHÔNG còn nhận đáp án trước khi nộp.
 *   - GET  /practice/catalog          ?exerciseType&cefrLevel&skillType&page&size → Page<PracticeCatalogItem>
 *   - GET  /practice/catalog/{id}                                               → PracticeQuiz (không đáp án)
 *   - POST /practice/catalog/{id}/grade { answers, scorePercent? }              → PracticeGradeResult
 *
 * Trước A3, web gọi `GET /practice/exercises[/{id}]` — DTO trả `contentJson` nguyên văn, gồm
 * `questions[].correctAnswer` + `explanation`, và trình duyệt tự chấm. Mở DevTools là thấy đáp án.
 * Giờ server chấm (`PracticeQuizService`) và chỉ trả đáp án + giải thích SAU khi nộp. API cũ vẫn
 * còn ở backend cho client đã phát hành; web không gọi nữa.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

/** Một thẻ trong thư viện — không có đề, không có đáp án. */
export interface PracticeCatalogItem {
  id: number
  exerciseType: string
  cefrLevel: string
  skillType: string
  examName: string | null
  sourceName: string
  sourceUrl?: string | null
  xpReward: number
}

export interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
}

/** Câu hỏi KHÔNG kèm đáp án. `gradable`: câu có đáp án trong DB (được chấm). */
export interface PracticeQuizQuestion {
  id: string
  type?: string | null
  question: string
  options?: string[] | null
  gradable: boolean
}

/** Đề bài tập (đã ẩn đáp án). `questions` rỗng ⇒ tài nguyên ngoài, chỉ tự xác nhận hoàn thành. */
export interface PracticeQuiz extends PracticeCatalogItem {
  title?: string | null
  instructions?: string | null
  readingText?: string | null
  questions: PracticeQuizQuestion[]
  gradableCount: number
}

/** Map id câu → đáp án người dùng chọn/gõ. */
export type PracticeAnswers = Record<string, string>

/** Kết quả từng câu SAU khi nộp. `correct = null`: câu không chấm được. */
export interface PracticeQuestionResult {
  id: string
  correct: boolean | null
  correctAnswer: string | null
  explanation: string | null
}

export interface PracticeGradeResult {
  graded: boolean
  correctCount: number
  total: number
  /** Điểm server ghi nhận (đọc lại từ lịch sử vừa ghi). */
  scorePercent: number
  /**
   * XP server THẬT SỰ trao (đọc lại từ lịch sử vừa ghi — gồm luật riêng như XP cố định cho bài
   * nguồn ngoài). `null`/thiếu: backend cũ không báo → client tự ước lượng `score% × xpReward`.
   */
  xpEarned?: number | null
  questions: PracticeQuestionResult[]
}

export const practiceApi = {
  list(params: { cefrLevel?: string; exerciseType?: string; skillType?: string } = {}) {
    const query: Record<string, string> = {}
    if (params.cefrLevel) query.cefrLevel = params.cefrLevel
    if (params.exerciseType) query.exerciseType = params.exerciseType
    if (params.skillType) query.skillType = params.skillType
    return api
      .get<SpringPage<PracticeCatalogItem>>('/practice/catalog', { params: query })
      .then((r) => r.data)
  },

  /** Đề không kèm đáp án. */
  quiz(id: number) {
    return api.get<PracticeQuiz>(`/practice/catalog/${id}`).then((r) => r.data)
  },

  /**
   * Nộp bài: server chấm, ghi lượt làm + XP, rồi trả đúng/sai + đáp án + giải thích.
   * `scorePercent` chỉ có nghĩa với bài tài nguyên ngoài (không có đáp án) — tự xác nhận hoàn thành.
   */
  grade(id: number, body: { answers: PracticeAnswers; scorePercent?: number }) {
    return api.post<PracticeGradeResult>(`/practice/catalog/${id}/grade`, body).then((r) => r.data)
  },
}
