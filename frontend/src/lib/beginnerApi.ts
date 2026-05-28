import api from './api'

export interface BeginnerItem {
  sequenceOrder: number
  itemType: string
  titleDe: string
  titleVi: string
  exampleDe: string
  exampleVi: string
  audioHint: string
}

export interface BeginnerSessionResponse {
  welcomeMessage: string
  items: BeginnerItem[]
  firstSpeakingPrompt: string
  encouragement: string
}

export interface BeginnerSpeakingResponse {
  templateId: number
  templateName: string
  userPrompt: string
  systemPrompt: string
  encouragement: string
  sampleResponses: string[]
}

export const beginnerApi = {
  getFirstSession: () => api.get<BeginnerSessionResponse>('/beginner/first-session'),
  completeFirstSession: () => api.post<void>('/beginner/first-session/complete'),
  getDay1Speaking: () => api.get<BeginnerSpeakingResponse>('/speaking/beginner/day1'),
  getBeginnerTemplates: () => api.get<BeginnerSpeakingResponse[]>('/speaking/beginner/templates'),
}
