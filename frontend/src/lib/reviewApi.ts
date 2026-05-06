import api from './api'

// ─────────────────────────────────────────────
// Types — Spaced Repetition Review Queue
// ─────────────────────────────────────────────

export interface ReviewItem {
  id: number
  itemType: string   // e.g. "WORD", "PHRASE"
  itemRef: string    // e.g. word id or phrase id
  prompt: string     // question / front of flashcard
  repetitions: number
  intervalDays: number
  easeFactor: number
  dueAt: string      // ISO datetime
}

export interface ReviewDueResponse {
  limit: number
  totalSeededItems: number
  items: ReviewItem[]
}

export interface ReviewGradeResponse {
  id: number
  quality: number
  newIntervalDays: number
  nextDueAt: string
  easeFactor: number
}

// ─────────────────────────────────────────────
// Types — Error Review Tasks
// ─────────────────────────────────────────────

export interface ErrorReviewTaskDto {
  id: number
  errorCode: string
  taskType: string
  dueAt: string
  intervalDays: number
}

// ─────────────────────────────────────────────
// API adapter
// ─────────────────────────────────────────────

export const reviewApi = {
  /** GET /api/reviews/due — fetch cards due for review today */
  getDue: (limit = 20, type?: string) =>
    api.get<ReviewDueResponse>('/reviews/due', { params: { limit, type } })
      .then(r => r.data),

  /**
   * POST /api/reviews/{id}/grade — grade a card (SM-2 quality 0-5)
   * 0-2 = failed (forgot), 3-5 = passed (remembered)
   */
  grade: (reviewId: number, quality: number) =>
    api.post<ReviewGradeResponse>(`/reviews/${reviewId}/grade`, { quality })
      .then(r => r.data),

  /** GET /api/review-tasks/me/today — speaking error tasks due today */
  getTodayTasks: () =>
    api.get<ErrorReviewTaskDto[]>('/review-tasks/me/today')
      .then(r => r.data),

  /** POST /api/review-tasks/{id}/complete — mark task done */
  completeTask: (taskId: number, passed: boolean) =>
    api.post(`/review-tasks/${taskId}/complete`, { passed })
      .then(r => r.data),
}
