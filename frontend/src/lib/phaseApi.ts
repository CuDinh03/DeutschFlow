import api from './api'

export type PhaseType = 'FOUNDATION' | 'PRODUCTION' | 'FLUENCY' | 'GRADUATED'

export interface PhaseStateResponse {
  currentPhase: PhaseType
  phaseStartedAt: string
  vocabularyMasteredCount: number
  speakingMinutesTotal: number
  grammarAccuracyPercent: number
  sessionsCompleted: number
  readyToAdvance: boolean
  graduatedAt: string | null
}

export interface NextActionResponse {
  currentPhase: string
  nextActions: string[]
}

export const phaseApi = {
  getCurrent: () => api.get<PhaseStateResponse>('/phase/current'),
  getNextActions: () => api.get<NextActionResponse>('/phase/next-action'),
}
