import api from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Đề xuất thay đổi lịch (PR-5/PR-6) — phía giáo viên theo dõi/rút, phía trung tâm
// duyệt/từ chối/xem trước. PENDING không đổi lịch chính thức (AC18); duyệt nguyên
// tử + chống nền lỗi thời phía BE (AC10).
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type ChangeRequestType =
  | 'CANCEL_SESSION'
  | 'ADD_MAKEUP'
  | 'MOVE_SESSION'
  | 'UPDATE_PATTERN'
  | 'MOVE_MILESTONE'

export interface ScheduleChangeRequest {
  id: number
  classId: number
  className: string
  requestType: ChangeRequestType
  payload: Record<string, unknown>
  impactSnapshot: {
    affectedSessionIds?: number[]
    plannedContentCount?: number
    warnings?: string[]
  } | null
  reason: string | null
  hasWeekend: boolean
  status: ChangeRequestStatus
  requestedBy: number
  requestedByName: string
  requestedAt: string
  reviewedBy: number | null
  reviewedAt: string | null
  rejectReason: string | null
  appliedAt: string | null
}

/** Dự báo tiến độ theo phân bổ (AC09/AC17). */
export interface ScheduleForecast {
  remainingMinutes: number
  availableMinutes: number
  futureSessionCount: number
  /** null = thiếu khung (xem shortfallMinutes). */
  projectedEndDate: string | null
  shortfallMinutes: number
  suggestedExtraSessions: number
  milestones: ForecastMilestone[]
}

export interface ForecastMilestone {
  id: number
  kind: 'EXAM' | 'COURSE_END'
  title: string
  plannedDate: string
  note: string | null
  atRisk: boolean
}

export interface SchedulePreview {
  request: ScheduleChangeRequest
  current: ScheduleForecast
  /** null với UPDATE_PATTERN — người duyệt đọc impactSnapshot. */
  projected: ScheduleForecast | null
}

// ── Phía giáo viên ───────────────────────────────────────────────────────────

export async function listClassChangeRequests(classId: number): Promise<ScheduleChangeRequest[]> {
  const res = await api.get<ScheduleChangeRequest[]>(
    `/v2/teacher/class-schedule/classes/${classId}/change-requests`,
  )
  return res.data ?? []
}

export async function cancelChangeRequest(requestId: number): Promise<void> {
  await api.delete(`/v2/teacher/class-schedule/change-requests/${requestId}`)
}

export async function getClassForecast(classId: number): Promise<ScheduleForecast> {
  const res = await api.get<ScheduleForecast>(`/v2/teacher/class-schedule/classes/${classId}/forecast`)
  return res.data
}

// ── Phía trung tâm (duyệt) ───────────────────────────────────────────────────

export async function listPendingChangeRequests(): Promise<ScheduleChangeRequest[]> {
  const res = await api.get<ScheduleChangeRequest[]>('/org/schedule/change-requests')
  return res.data ?? []
}

export async function approveChangeRequest(requestId: number): Promise<ScheduleChangeRequest> {
  const res = await api.post<ScheduleChangeRequest>(`/org/schedule/change-requests/${requestId}/approve`)
  return res.data
}

export async function rejectChangeRequest(requestId: number, reason: string): Promise<ScheduleChangeRequest> {
  const res = await api.post<ScheduleChangeRequest>(`/org/schedule/change-requests/${requestId}/reject`, { reason })
  return res.data
}

export async function getChangeRequestPreview(requestId: number): Promise<SchedulePreview> {
  const res = await api.get<SchedulePreview>(`/org/schedule/change-requests/${requestId}/preview`)
  return res.data
}
