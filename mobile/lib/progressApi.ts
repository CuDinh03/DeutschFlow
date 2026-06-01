// Typed client for learner progress (MVP checklist §5.3 "progress/history").
// Mirrors the shape the web progress page consumes from GET /api/progress/me/overview.

import api from './api'

export interface SkillData {
  score: number
  exercisesDone: number
  lastPracticed?: string | null
}

export interface WeeklyPoint {
  week: string
  minutesStudied: number
  xpEarned: number
}

export interface ProgressOverview {
  cefrLevel: string
  skills: {
    lesen: SkillData
    hoeren: SkillData
    schreiben: SkillData
    sprechen: SkillData
  }
  grammarMastery: number
  vocabCoverage: number
  mockExamBestScore: number
  examReady: boolean
  weeklyProgress: WeeklyPoint[]
}

export const progressApi = {
  getOverview: () => api.get<ProgressOverview>('/progress/me/overview').then((r) => r.data),
}
