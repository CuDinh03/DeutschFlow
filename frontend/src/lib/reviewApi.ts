import api from './api'

// ─────────────────────────────────────────────
// Types — Vocabulary review (FSRS, /api/srs)
// ─────────────────────────────────────────────

export interface VocabReviewCard {
  id: number
  vocabId: string
  german: string
  meaning: string
  exampleDe?: string
  speakDe?: string
  repetitions: number
  nextReviewAt: string // ISO datetime
}

// ─────────────────────────────────────────────
// Types — Error Review Tasks (grammar, /api/review-tasks)
// ─────────────────────────────────────────────

export interface ErrorReviewTaskDto {
  id: number
  errorCode: string
  taskType: string
  dueAt: string
  intervalDays: number
}

export interface ReviewTasksResponse {
  tasks: ErrorReviewTaskDto[]
  lockedCount: number
}

export interface ImportReviewErrorRequest {
  errors: Array<string | { errorCode?: string; ruleViShort?: string; wrongSpan?: string; correctedSpan?: string }>
}

// ─────────────────────────────────────────────
// API adapter
// ─────────────────────────────────────────────

export const reviewApi = {
  /** GET /api/srs/due — vocab cards due for review today (FSRS). */
  getDueVocab: () =>
    api.get<VocabReviewCard[]>('/srs/due').then(r => r.data ?? []),

  /**
   * POST /api/srs/review — grade a vocab card (SM-2 quality 0-5, mapped to FSRS 1-4 server-side).
   * 0-2 = failed (forgot), 3-5 = passed (remembered).
   */
  gradeVocab: (vocabId: string, quality: number) =>
    api.post('/srs/review', { vocabId, quality }).then(r => r.data),

  /** GET /api/review-tasks/me/today — grammar error tasks due today. */
  getTodayTasks: () =>
    api.get<ReviewTasksResponse>('/review-tasks/me/today').then(r => r.data),

  /** POST /api/review-tasks/{id}/complete — mark a grammar task done. */
  completeTask: (taskId: number, passed: boolean) =>
    api.post(`/review-tasks/${taskId}/complete`, { passed }).then(r => r.data),
}
