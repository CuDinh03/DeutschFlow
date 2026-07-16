import api from '@/lib/api'

/**
 * practiceApi — thư viện bài tập bổ trợ (`/api/practice`).
 *
 * Giữ nguyên contract của backend `PracticeController`:
 *   - GET  /practice/exercises        ?exerciseType&cefrLevel&skillType&page&size  → Page<PracticeExerciseDto>
 *   - GET  /practice/exercises/{id}                                                → PracticeExerciseDto
 *   - POST /practice/submit           { practiceId, scorePercent, answerDataJson } → 204
 *
 * ⚠️ Vì sao có `gradePractice` ở đây: trang v1 (`/student/practice`) KHÔNG hề render đề. Nó chỉ
 * liệt kê thẻ bài tập rồi POST thẳng `scorePercent: 100` khi bấm "Làm bài ngay"
 * (PracticePageClient.tsx:63) — tức ai bấm cũng "đạt 100%" và ăn trọn XP mà không làm câu nào.
 * Trong khi đó DTO đã trả sẵn `contentJson` chứa đủ `questions[].correctAnswer` — v1 chỉ là bỏ
 * quên. Bản port v2 vì vậy chấm điểm THẬT trên đáp án API trả về, thay vì bê nguyên bug.
 *
 * Lưu ý bảo mật (không thuộc phạm vi đợt này): backend TIN scorePercent do client gửi và
 * `contentJson` lộ luôn `correctAnswer` xuống client. Muốn chống gian lận thì phải chấm ở server
 * (nhận answers, tự so đáp án) — cần đổi backend, xem báo cáo.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export interface PracticeExercise {
  id: number
  exerciseType: string
  cefrLevel: string
  skillType: string
  examName: string | null
  /** JSON thô của đề (chuỗi jsonb). Có thể rỗng với bài "tài nguyên ngoài". */
  contentJson?: string | null
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

export interface PracticeQuestion {
  id: string
  type?: string
  question: string
  options?: string[]
  correctAnswer?: string
  explanation?: string
}

export interface PracticeContent {
  title?: string
  instructions?: string
  readingText?: string
  questions: PracticeQuestion[]
}

/** Map câu hỏi → đáp án người dùng chọn/gõ. */
export type PracticeAnswers = Record<string, string>

/** So đáp án "mềm": bỏ hoa/thường, dấu câu thừa, khoảng trắng lặp. */
function normalizeAnswer(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[.,!?;:"'`()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse `contentJson` → đề bài. Backend lưu jsonb nhưng field Java là String nên Jackson trả về
 * CHUỖI JSON; vẫn phòng trường hợp trả object.
 */
export function parsePracticeContent(raw: unknown): PracticeContent | null {
  if (!raw) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null

  const o = obj as Record<string, unknown>
  const rawQs = Array.isArray(o.questions) ? o.questions : []

  const questions: PracticeQuestion[] = rawQs
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
    .map((q, i) => ({
      id: typeof q.id === 'string' && q.id ? q.id : `q${i + 1}`,
      type: typeof q.type === 'string' ? q.type : undefined,
      question: typeof q.question === 'string' ? q.question : '',
      options: Array.isArray(q.options)
        ? q.options.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined,
      correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer : undefined,
      explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
    }))
    .filter((q) => q.question.length > 0)

  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    instructions: typeof o.instructions === 'string' ? o.instructions : undefined,
    readingText: typeof o.readingText === 'string' ? o.readingText : undefined,
    questions,
  }
}

/** Chỉ những câu API có trả `correctAnswer` mới chấm được. */
export function gradableQuestions(questions: PracticeQuestion[]): PracticeQuestion[] {
  return questions.filter((q) => !!q.correctAnswer && q.correctAnswer.trim().length > 0)
}

export interface PracticeGrade {
  correct: number
  total: number
  scorePercent: number
  /** Đúng/sai theo từng câu (chỉ gồm câu chấm được). */
  perQuestion: Record<string, boolean>
}

/**
 * Chấm điểm THẬT: so đáp án người dùng với `correctAnswer` do API trả về.
 * Câu không có `correctAnswer` bị loại khỏi mẫu số (không thể chấm ⇒ không bịa).
 */
export function gradePractice(questions: PracticeQuestion[], answers: PracticeAnswers): PracticeGrade {
  const gradable = gradableQuestions(questions)
  const perQuestion: Record<string, boolean> = {}
  let correct = 0

  for (const q of gradable) {
    const ok = normalizeAnswer(answers[q.id] ?? '') === normalizeAnswer(q.correctAnswer ?? '')
    perQuestion[q.id] = ok
    if (ok) correct += 1
  }

  const total = gradable.length
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0
  return { correct, total, scorePercent, perQuestion }
}

export const practiceApi = {
  list(params: { cefrLevel?: string; exerciseType?: string; skillType?: string } = {}) {
    const query: Record<string, string> = {}
    if (params.cefrLevel) query.cefrLevel = params.cefrLevel
    if (params.exerciseType) query.exerciseType = params.exerciseType
    if (params.skillType) query.skillType = params.skillType
    return api
      .get<SpringPage<PracticeExercise>>('/practice/exercises', { params: query })
      .then((r) => r.data)
  },

  get(id: number) {
    return api.get<PracticeExercise>(`/practice/exercises/${id}`).then((r) => r.data)
  },

  submit(body: { practiceId: number; scorePercent: number; answerDataJson?: string }) {
    return api.post('/practice/submit', body).then((r) => r.data)
  },
}
