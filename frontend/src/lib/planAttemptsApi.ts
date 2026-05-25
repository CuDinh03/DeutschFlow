import api from '@/lib/api'

/** Spring Data Page shape from GET /api/plan/me/attempts */
export interface PagePlanAttempts {
  content: PlanAttemptRow[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface PlanAttemptRow {
  id: number
  weekNumber: number
  sessionIndex: number
  attemptNo: number
  scorePercent: number
  createdAt: string
  mistakeCount: number | null
}

export const planAttemptsApi = {
  list: (page = 0, size = 20) =>
    api.get<PagePlanAttempts>('/plan/me/attempts', { params: { page, size } }),
}
