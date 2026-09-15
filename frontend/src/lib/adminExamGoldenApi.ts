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
  /** URL nghe lại có hạn (~1h). null = phiên không lưu audio → chấm trên transcript. */
  audioUrl: string | null
}

/** Người học đã đồng ý cho lưu audio phục vụ hiệu chuẩn (G.2/G.3). */
export interface GoldenParticipant {
  userId: number
  displayName: string | null
  email: string | null
  consentedAt: string
  note: string | null
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
  /** F-17: khoảng điểm máy vắt qua ngưỡng — đối chiếu đạt/trượt bỏ qua phiên này. */
  borderline?: boolean | null
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
  /** Số cặp máy "sát ngưỡng" (không tính vào mẫu số đạt/trượt) — gate theo dõi ≤20%. */
  machineBorderline?: number
}

export interface GoldenRegradeBatchRow {
  sessionId: number
  provider: string
  level: string
  storedTotal: number | null
  freshTotal: number | null
  totalDelta: number
  passedChanged: boolean
  bandChanges: number
  error: string | null
}

/** Regression harness (tài liệu gate §6.3): regrade cả bộ golden, không ghi đè kết quả học viên. */
export interface GoldenRegradeBatchResult {
  requested: number
  regraded: number
  failed: number
  passFlips: number
  avgTotalDelta: number
  totalBandChanges: number
  rows: GoldenRegradeBatchRow[]
}

export const REGRADE_BATCH_MAX = 100

type Filters = { provider?: string; level?: string }

export const adminExamGoldenApi = {
  listSessions: (params?: Filters) => api.get<GoldenSessionRow[]>('/admin/speaking/exam/golden/sessions', { params }),
  detail: (id: number) => api.get<GoldenDetail>(`/admin/speaking/exam/golden/sessions/${id}`),
  saveRatings: (id: number, ratings: GoldenRatingRow[]) =>
    api.put<GoldenSaveResult>(`/admin/speaking/exam/golden/sessions/${id}/ratings`, { ratings }),
  compare: (params?: Filters) => api.get<GoldenCompareReport>('/admin/speaking/exam/golden/compare', { params }),
  exportCsv: (params?: Filters) =>
    api.get<Blob>('/admin/speaking/exam/golden/export.csv', { params, responseType: 'blob' }),
  /** TỐN token thật (≈12k/phiên) — trần 100/lần, chỉ chạy trong vòng hiệu chỉnh của gate. */
  regradeBatch: (params?: Filters & { ratedOnly?: boolean; limit?: number }) =>
    api.post<GoldenRegradeBatchResult>('/admin/speaking/exam/golden/regrade-batch', undefined, {
      params,
      timeout: 15 * 60_000,
    }),

  // ── Chiến dịch hiệu chuẩn: ai được lưu audio ────────────────────────────────────────────
  listParticipants: () => api.get<GoldenParticipant[]>('/admin/speaking/exam/golden/participants'),
  addParticipant: (body: { userId: number; consentedAt?: string; note?: string }) =>
    api.post<GoldenParticipant>('/admin/speaking/exam/golden/participants', body),
  /** Rút đồng ý: gỡ khỏi chiến dịch + xoá audio mọi phiên của người đó (transcript giữ nguyên). */
  removeParticipant: (userId: number) =>
    api.delete<{ userId: number; audioDeleted: number }>(`/admin/speaking/exam/golden/participants/${userId}`),
  /** `failed > 0`: S3 từ chối xoá một số key — tham chiếu được GIỮ để xoá lại; chưa được coi là sạch (F-12). */
  purgeSessionAudio: (id: number) =>
    api.delete<{ sessionId: number; deleted: number; failed?: number }>(`/admin/speaking/exam/golden/sessions/${id}/audio`),
}
