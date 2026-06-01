// Mock-exam shapes + mapping. Pure (no imports). Backend
// GET /api/mock-exams?cefrLevel=X returns raw snake_case rows.

export interface ExamVariant {
  id: number
  title: string
  cefrLevel: string
  totalQuestions: number
  timeLimitMinutes: number
  isRecommended?: boolean
}

export interface RawMockExam {
  id: number
  cefr_level: string
  title: string
  time_limit_minutes: number
  total_questions?: number
}

export function mapExam(e: RawMockExam): ExamVariant {
  return {
    id: e.id,
    title: e.title,
    cefrLevel: e.cefr_level,
    totalQuestions: e.total_questions ?? 0,
    timeLimitMinutes: e.time_limit_minutes,
  }
}
