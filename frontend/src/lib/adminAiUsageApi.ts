import api from '@/lib/api'

/** Báo cáo AI usage từ ledger (`/api/admin/analytics/ai-usage`, ADMIN) — kế hoạch luyện thi nói N0.6/T.3. */

export interface AiUsageFeatureRow {
  feature: string
  model: string
  calls: number
  promptTokens: number
  cachedPromptTokens: number
  completionTokens: number
  totalTokens: number
  estUsd: number
  estVnd: number
}

export interface AiUsageSttRow {
  feature: string
  model: string
  calls: number
  seconds: number
  estUsd: number
  estVnd: number
}

export interface AiUsageSessionRow {
  sessionId: number
  features: string
  calls: number
  totalTokens: number
  estUsd: number
  estVnd: number
}

export interface AiUsageReport {
  from: string
  to: string
  featurePrefix: string
  rows: AiUsageFeatureRow[]
  stt: AiUsageSttRow[]
  sessions: AiUsageSessionRow[]
  totals: { calls: number; totalTokens: number; sttSeconds: number; estUsd: number; estVnd: number }
  usdVndRate: number
}

export const adminAiUsageApi = {
  report: (params: { from?: string; to?: string; featurePrefix?: string }) =>
    api.get<AiUsageReport>('/admin/analytics/ai-usage', { params }),
}
