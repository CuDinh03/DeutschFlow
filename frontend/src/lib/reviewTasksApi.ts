import api from './api'

export interface ErrorReviewTaskDto {
  id: number
  errorCode: string
  taskType: string
  dueAt: string
  intervalDays: number
}

export const reviewTasksApi = {
  getToday: () => api.get<ErrorReviewTaskDto[]>('/review-tasks/me/today'),
  complete: (taskId: number, passed: boolean) =>
    api.post<void>(`/review-tasks/${taskId}/complete`, { passed }),
}
