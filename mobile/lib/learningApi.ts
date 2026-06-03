// Misc student learning endpoints not big enough for their own module.

import api from './api'

export interface ErrorSkill {
  errorCode: string
  count: number
  lastSeenAt: string | null
  priorityScore: number
  sampleWrong: string | null
  sampleCorrected: string | null
  ruleViShort: string | null
  resolved: boolean
}

export const learningApi = {
  /** Aggregated recurring mistakes for the current user (last N days). */
  getErrorSkills: (days = 30) =>
    api.get<ErrorSkill[]>('/error-skills/me', { params: { days } }).then((r) => r.data),

  /** Mark a vocabulary word as learned (schedules it into SRS). */
  markWordLearned: (wordId: string) => api.post(`/vocabulary/${wordId}/learn`),
}
