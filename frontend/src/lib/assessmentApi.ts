import api from './api'

export interface B1ReadinessResponse {
  vocabularyCheckPassed: boolean
  speakingCheckPassed: boolean
  grammarCheckPassed: boolean
  confidenceCheckPassed: boolean
  mockExamPassed: boolean
  readinessScore: number
  fullyReady: boolean
  lastAssessmentAt: string | null
  graduationConfirmedAt: string | null
}

export const assessmentApi = {
  getReadiness: () => api.get<B1ReadinessResponse>('/assessment/b1/readiness'),
  evaluate: () => api.post<B1ReadinessResponse>('/assessment/b1/evaluate'),
  recordMockExam: (passed: boolean) =>
    api.post<B1ReadinessResponse>(`/assessment/b1/mock-exam?passed=${passed}`),
}
