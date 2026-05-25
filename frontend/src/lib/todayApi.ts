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

export interface TodayProgress {
  rollingAccuracyPercent: number
  streakDays: number
  topWeakErrorCode: string | null
}

export interface TodayPlan {
  dueRepairTasks: TodayDueRepairTask[]
  recommendedSpeaking: TodayRecommended
  /** Weekly themed assignment (separate route from casual AI speaking). */
  recommendedWeeklySpeaking?: TodayRecommended
  recommendedVocabPractice: TodayRecommended
  progress: TodayProgress
}

export const todayApi = {
  getMe: () => api.get<TodayPlan>('/today/me'),
}
