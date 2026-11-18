// Luyện đề telc (03/11/2026) — `/api/mock-exams/practice`. Bản sinh đôi của
// `frontend/src/lib/telcPracticeApi.ts`: làm từng Teil, không ép giờ, kiểm tra xong có phân tích từng câu.
// Khác `examApi.ts` (lượt thi thử cũ) và `/api/practice` (thư viện bài tập bổ trợ).

import api from './api'

export interface PracticeItemResult {
  id: string
  label: string
  given: string | null
  givenText: string | null
  correct: string
  correctText: string | null
  answered: boolean
  isCorrect: boolean
  points: number
  whyRight: string | null
  whyWrong: string | null
  trap: string | null
  evidence: string[]
  need: string | null
  rule: string | null
}

export interface PracticeTeilResult {
  teilKey: string
  type: string
  score: number
  max: number
  correctCount: number
  total: number
  items: PracticeItemResult[]
  unusedOptions: { key: string; text: string; note: string | null }[]
}

export interface WritingAnnotation {
  quote: string | null
  insertAfter: string | null
  correction: string
  category: 'INHALT' | 'KOHAERENZ' | 'GRAMMATIK' | 'WORTSCHATZ' | 'RECHTSCHREIBUNG' | 'REGISTER' | string
  kriterium: 'I' | 'II' | 'III' | null
  leitpunkt: number | null
  whyVi: string
  ruleVi: string
}

/** Phiếu chấm Viết telc của chế độ luyện (phiếu thi thử + `annotations` + `musterloesung`). */
export interface WritingEvaluation {
  status: 'AI_EVALUATED' | 'PENDING_AI_EVALUATION' | string
  total: number
  max: number
  percentage?: number
  criteria?: { key: string; score: number; max: number; band?: string }[]
  bands?: Record<string, string>
  leitpunkte_fehlt?: number[]
  kein_a_weil?: string[]
  thema_verfehlt?: boolean
  situierung_verfehlt?: boolean
  feedback_vi?: string
  feedback_de?: string
  strengths?: string[]
  improvements?: string[]
  annotations?: WritingAnnotation[]
  musterloesung?: string
}

export interface PracticeProgress {
  answers: Record<string, string>
  checked: boolean
  score: number | null
  max: number | null
  elapsedSeconds: number
  updatedAt: string | null
  result: PracticeTeilResult | WritingEvaluation | null
  /** Lúc chấm gần nhất (09/11/2026). Khác `updatedAt`: lưu nháp Viết đổi `updatedAt` mà giữ điểm cũ. */
  checkedAt?: string | null
  /** "Vì sao tôi chọn" (B3, 09/11/2026): ghi chú ngắn theo câu, `{itemId: chữ}`. */
  notes?: Record<string, string>
}

/** Lời giải thích AI cho một câu đã nộp (B3). `cached` = bản đã lưu, không trừ lượt AI. */
export interface ItemAiAnswer {
  itemId: string
  locale: string
  answer: string
  cached: boolean
}

export interface PracticeTeil {
  key: string
  section: 'LESEN' | 'SPRACHBAUSTEINE' | 'SCHREIBEN' | string
  teil: number
  type: string | null
  items: number
  maxPoints: number
  suggestMinutes: number | null
  progress: PracticeProgress | null
}

export interface PracticeOverview {
  examId: number
  title: string
  level: string
  format: string
  sectionsJson: string
  teile: PracticeTeil[]
}

export const WRITING_KEY = 'SCHREIBEN-1'

export async function getPracticeAccess(): Promise<boolean> {
  try {
    const { data } = await api.get<{ enabled: boolean }>('/mock-exams/practice/access')
    return !!data?.enabled
  } catch {
    return false
  }
}

/** Điểm một Teil lấy từ một lượt thi thử đã nộp hoặc dừng giữa chừng (09/11/2026). `at` = lúc lượt kết thúc. */
export interface MockTeilScore {
  attemptId: number
  examId: number
  key: string
  section: string
  teil: number
  score: number
  max: number
  at: string
}

/** Điểm từng Teil của các lượt thi thử gần nhất — gộp vào "Bốn kỹ năng". Lỗi thì coi như chưa có lượt nào. */
export async function getMockTeilScores(): Promise<MockTeilScore[]> {
  try {
    const { data } = await api.get<MockTeilScore[]>('/mock-exams/practice/mock-teile')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function getPracticeOverview(examId: number): Promise<PracticeOverview> {
  const { data } = await api.get<PracticeOverview>(`/mock-exams/practice/${examId}`)
  return data
}

