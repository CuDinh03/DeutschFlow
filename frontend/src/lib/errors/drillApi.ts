import api from '@/lib/api'

export interface ErrorSkillDto {
  errorCode: string
  count: number
  lastSeenAt: string
  priorityScore: number
  sampleWrong: string | null
  sampleCorrected: string | null
  ruleViShort: string | null
}

export const errorSkillsApi = {
  getMine: (days = 30) => api.get<ErrorSkillDto[]>('/error-skills/me', { params: { days } }),

  repairAttempt: (errorCode: string) =>
    api.post<void>(`/error-skills/me/${encodeURIComponent(errorCode)}/repair-attempt`),
}
