/**
 * Luyện đề telc (03/11/2026) — `/api/mock-exams/practice`. Làm từng Teil, không ép giờ, kiểm tra
 * xong có phân tích từng câu; Viết chấm bằng AI có chỉ lỗi trong bài. Không tạo lượt thi.
 *
 * Khác `practiceApi.ts` (thư viện bài tập bổ trợ `/api/practice`) — hai tính năng không liên quan.
 */
import api from '@/lib/api'
import { waitForAsyncJob } from '@/lib/asyncJob'

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

export async function savePracticeDraft(
  examId: number,
  teilKey: string,
  answers: Record<string, string>,
  elapsedSeconds: number,
): Promise<PracticeProgress | null> {
  const { data } = await api.put<PracticeProgress | null>(
    `/mock-exams/practice/${examId}/teile/${teilKey}/draft`,
    { answers, elapsedSeconds },
  )
  return data
}

export async function checkPracticeTeil(
  examId: number,
  teilKey: string,
  answers: Record<string, string>,
  elapsedSeconds: number,
): Promise<PracticeProgress> {
  const { data } = await api.post<PracticeProgress>(`/mock-exams/practice/${examId}/teile/${teilKey}/check`, {
    answers,
    elapsedSeconds,
  })
  return data
}

/** "Làm lại" Teil. `keepMarks = false` xoá cả đánh dấu bài đọc (server mặc định giữ). */
export async function resetPracticeTeil(examId: number, teilKey: string, keepMarks = true): Promise<void> {
  await api.delete(`/mock-exams/practice/${examId}/teile/${teilKey}`, keepMarks ? undefined : { params: { keepMarks: false } })
}

/** Gói đánh dấu bài đọc của Teil (09/11/2026) — xem `components/exam/marks/marksModel.ts`. */
export interface PracticeMarks {
  marks: unknown
  updatedAt: string | null
}

export function practiceMarksPath(examId: number, teilKey: string): string {
  return `/mock-exams/practice/${examId}/teile/${teilKey}/marks`
}

export async function getPracticeMarks(examId: number, teilKey: string): Promise<PracticeMarks> {
  const { data } = await api.get<PracticeMarks>(practiceMarksPath(examId, teilKey))
  return data
}

export async function savePracticeMarks(examId: number, teilKey: string, marks: unknown): Promise<PracticeMarks> {
  const { data } = await api.put<PracticeMarks>(practiceMarksPath(examId, teilKey), { marks })
  return data
}

/** Gửi bài Viết rồi chờ AI chấm xong (poll job nền). */
export async function gradePracticeWriting(
  examId: number,
  text: string,
  elapsedSeconds: number,
  signal?: AbortSignal,
): Promise<WritingEvaluation> {
  const { data } = await api.post<{ jobId: string }>(`/mock-exams/practice/${examId}/schreiben`, {
    text,
    elapsedSeconds,
  })
  return waitForAsyncJob<WritingEvaluation>(data.jobId, { timeoutMs: 180_000, signal })
}
