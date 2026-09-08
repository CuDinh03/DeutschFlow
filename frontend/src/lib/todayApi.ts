import api from './api'

export interface TodayDueRepairTask {
  id: number
  errorCode: string
  taskType: string
  dueAt: string
  intervalDays: number
}

export interface TodayRecommended {
  href: string
  topic: string | null
  cefrLevel: string | null
  focusOrStructures: string[]
}

export interface TodayPlan {
  dueRepairTasks: TodayDueRepairTask[]
  recommendedSpeaking: TodayRecommended
  /** Weekly themed assignment (separate route from casual AI speaking). */
  recommendedWeeklySpeaking?: TodayRecommended
  recommendedVocabPractice: TodayRecommended
}

/**
 * V-12b (08/09/2026): GỠ `progress: TodayProgress` khỏi kiểu này. Backend `TodayPlanDto` chỉ có
 * `dueRepairTasks / recommendedSpeaking / recommendedWeeklySpeaking / recommendedVocabPractice` —
 * `TodayProgressDto` tồn tại nhưng KHÔNG được TodayPlanDto tham chiếu, nên `/today/me` chưa bao giờ
 * trả `progress`. Kiểu này hứa một trường không có thật, và mọi thứ dựng trên nó (chuỗi ngày học,
 * việc "sửa lỗi hay sai") là mã chết. Chuỗi ngày học có nguồn THẬT ở `/student/dashboard`.
 */
export const todayApi = {
  getMe: () => api.get<TodayPlan>('/today/me'),
}
