import api from './api'

export interface AdaptiveRefreshResponse {
  injected: boolean
  reason: string
  errorCode: string | null
  week: number | null
  sessionIndex: number | null
}

export const planApi = {
  refreshAdaptive: () =>
    api.post<AdaptiveRefreshResponse>('/plan/me/adaptive-refresh'),
}
