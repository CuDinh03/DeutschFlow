import api from '@/lib/api'

/** API G.1 Golden set — `/api/admin/speaking/exam/golden/**` (ADMIN). */

export interface GoldenSessionRow {
  sessionId: number
  provider: string
  level: string
  createdAt: string
  machineTotal: number | null
  machineMax: number | null
  machinePassed: boolean | null
  raters: string[]
}

export interface GoldenSheetCriterion {
  code: string
  label: string
  max: number
  item: boolean
}

export interface GoldenSheetStructure {
  scale: 'A_E' | 'A_D' | 'VHN'
  bands: string[]
  parts: { teilNo: number; criteria: GoldenSheetCriterion[] }[]
  global: GoldenSheetCriterion[]
}

export interface GoldenTurnLine {
  teilNo: number
  role: string
  transcript: string
}

export interface GoldenRatingRow {
  teilNo: number
  criterionCode: string
  band: string
}

export interface GoldenSummary {
  total: number | null
  max: number | null
  passed: boolean | null
}

export interface GoldenDetail {
  sessionId: number
  provider: string
  level: string
  createdAt: string
  sheet: GoldenSheetStructure
  turns: GoldenTurnLine[]
  machine: GoldenSummary
  machineBands: Record<string, string>
  myRatings: GoldenRatingRow[]
}

export interface GoldenAgreementStats {
  pairs: number
  exact: number
  within1: number
}

export interface GoldenSaveResult {
  human: GoldenSummary
  machine: GoldenSummary
  passAgree: boolean | null
  bands: GoldenAgreementStats
}

export interface GoldenCompareRow {
  sessionId: number
  provider: string
  level: string
  rater: string
  machine: GoldenSummary
  human: GoldenSummary
  bands: GoldenAgreementStats
}

export interface GoldenCompareReport {
  sessions: number
  ratedPairs: number
  passAgreePct: number | null
  exactBandPct: number | null
  within1BandPct: number | null
  rows: GoldenCompareRow[]
}

type Filters = { provider?: string; level?: string }

export const adminExamGoldenApi = {
  listSessions: (params?: Filters) => api.get<GoldenSessionRow[]>('/admin/speaking/exam/golden/sessions', { params }),
  detail: (id: number) => api.get<GoldenDetail>(`/admin/speaking/exam/golden/sessions/${id}`),
  saveRatings: (id: number, ratings: GoldenRatingRow[]) =>
    api.put<GoldenSaveResult>(`/admin/speaking/exam/golden/sessions/${id}/ratings`, { ratings }),
  compare: (params?: Filters) => api.get<GoldenCompareReport>('/admin/speaking/exam/golden/compare', { params }),
  exportCsv: (params?: Filters) =>
    api.get<Blob>('/admin/speaking/exam/golden/export.csv', { params, responseType: 'blob' }),
}
