import api from '@/lib/api'

/**
 * Bảng công giáo viên (V263/V264).
 *
 * Hai surface tách biệt, khớp với backend:
 *  - `/v2/teacher/timesheet/**` — giáo viên thao tác trên bảng công CỦA CHÍNH MÌNH.
 *  - `/org/timesheet/**`        — OWNER/MANAGER duyệt và tổng hợp toàn tổ chức.
 *
 * Không có trường nào về tiền: hệ chỉ chốt SỐ CÔNG rồi xuất ra ngoài cho kế toán.
 */

/** Một dòng công đã ghi nhận. */
export interface SessionRecord {
  id: number
  classId: number | null
  className: string | null
  sessionId: number | null
  startedAt: string
  durationMinutes: number
  teacherRole: string
  note: string | null
}

/** Buổi đã lên lịch, đã trôi qua, nhưng giáo viên chưa ghi công. */
export interface TimesheetSuggestion {
  sessionId: number
  classId: number
  className: string | null
  startedAt: string
  plannedDurationMinutes: number
}

export interface TimesheetSummary {
  from: string
  to: string
  totalSessions: number
  totalMinutes: number
  records: SessionRecord[]
  suggestions: TimesheetSuggestion[]
}

export type PeriodStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED'

export interface TimesheetPeriod {
  id: number
  teacherId: number
  teacherName: string | null
  periodStart: string
  periodEnd: string
  payUnit: 'SESSION' | 'HOUR'
  status: PeriodStatus
  /** false ⇒ dòng công trong kỳ bị đóng băng (backend cũng chặn, đây chỉ để ẩn nút). */
  editable: boolean
  totalSessions: number
  totalMinutes: number
  submittedAt: string | null
  reviewedAt: string | null
  rejectReason: string | null
}

export interface OrgTimesheet {
  from: string
  to: string
  teacherCount: number
  totalSessions: number
  totalMinutes: number
  periods: TimesheetPeriod[]
}

export interface RecordTeachingInput {
  sessionId?: number | null
  classId?: number | null
  startedAt?: string | null
  durationMinutes?: number | null
  teacherRole?: string | null
  note?: string | null
}

// ── giáo viên ───────────────────────────────────────────────────────────────

/** GET /api/v2/teacher/timesheet?from=&to= */
export async function getMyTimesheet(from: string, to: string): Promise<TimesheetSummary> {
  const res = await api.get<TimesheetSummary>('/v2/teacher/timesheet', { params: { from, to } })
  return res.data
}

/** POST /api/v2/teacher/timesheet/records */
export async function recordTeaching(data: RecordTeachingInput): Promise<SessionRecord> {
  const res = await api.post<SessionRecord>('/v2/teacher/timesheet/records', data)
  return res.data
}

/** DELETE /api/v2/teacher/timesheet/records/{id} */
export async function deleteRecord(id: number): Promise<void> {
  await api.delete(`/v2/teacher/timesheet/records/${id}`)
}

/** POST /api/v2/teacher/timesheet/periods?from=&to= — lấy hoặc mở kỳ. */
export async function openPeriod(from: string, to: string): Promise<TimesheetPeriod> {
  const res = await api.post<TimesheetPeriod>('/v2/teacher/timesheet/periods', null, {
    params: { from, to },
  })
  return res.data
}

/** POST /api/v2/teacher/timesheet/periods/{id}/submit */
export async function submitPeriod(id: number): Promise<TimesheetPeriod> {
  const res = await api.post<TimesheetPeriod>(`/v2/teacher/timesheet/periods/${id}/submit`)
  return res.data
}

// ── manager (OWNER | MANAGER) ───────────────────────────────────────────────

/** GET /api/org/timesheet?from=&to= */
export async function getOrgTimesheet(from: string, to: string): Promise<OrgTimesheet> {
  const res = await api.get<OrgTimesheet>('/org/timesheet', { params: { from, to } })
  return res.data
}

/** POST /api/org/timesheet/periods/{id}/approve */
export async function approvePeriod(id: number): Promise<TimesheetPeriod> {
  const res = await api.post<TimesheetPeriod>(`/org/timesheet/periods/${id}/approve`)
  return res.data
}

/** POST /api/org/timesheet/periods/{id}/reject — bắt buộc có lý do. */
export async function rejectPeriod(id: number, reason: string): Promise<TimesheetPeriod> {
  const res = await api.post<TimesheetPeriod>(`/org/timesheet/periods/${id}/reject`, { reason })
  return res.data
}

/** POST /api/org/timesheet/periods/{id}/lock */
export async function lockPeriod(id: number): Promise<TimesheetPeriod> {
  const res = await api.post<TimesheetPeriod>(`/org/timesheet/periods/${id}/lock`)
  return res.data
}

/**
 * Tải CSV bảng công. Endpoint có xác thực nên không dùng được thẻ <a href> thuần — phải đi qua
 * axios để mang theo header, rồi tự dựng blob và kích hoạt tải xuống.
 */
export async function downloadOrgTimesheetCsv(from: string, to: string): Promise<void> {
  const res = await api.get('/org/timesheet/export.csv', {
    params: { from, to },
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `cham-cong-${from}_${to}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Đổi tổng số phút thành chuỗi "12g 30p" — dùng chung cho cả hai màn hình. */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}p`
  return m === 0 ? `${h}g` : `${h}g ${m}p`
}
