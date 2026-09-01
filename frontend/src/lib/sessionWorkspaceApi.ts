import api from '@/lib/api'
import type { SessionContents } from '@/lib/sessionContentApi'
import type { ScheduleForecast } from '@/lib/scheduleChangeRequestApi'
import type { ClassLessonLog } from '@/lib/teacherLessonLogApi'

// Màn làm việc theo buổi (PR-7, spec §8): một response gom ba khối Trước/Trong/Sau.
// Chốt buổi = xác nhận buổi ĐÃ diễn ra (completed_at/by — buổi qua giờ không tự thành đã dạy).


export interface SessionWorkspace {
  sessionId: number
  classId: number
  className: string
  startAt: string
  durationMinutes: number
  teachingMinutes: number | null
  breakMinutes: number | null
  mode: 'ONLINE' | 'OFFLINE'
  room: string | null
  status: 'SCHEDULED' | 'CANCELLED' | 'MOVED'
  completedAt: string | null
  completedByTeacherId: number | null
  /** Còn trong cửa sổ sửa 7 ngày (hoặc đang có mở khóa 24h của người duyệt). */
  editable: boolean
  unlockActive: boolean
  editWindowDays: number
  contents: SessionContents
  /** Nhật ký của CHÍNH buổi — null khi chưa ghi. */
  log: ClassLessonLog | null
  roster: { studentId: number; displayName: string }[]
  forecast: ScheduleForecast
  /** PR-8 (spec §8): bài tập gắn CHÍNH buổi này — giáo viên thấy cả nháp. */
  assignments: SessionAssignment[]
}

export interface SessionAssignment {
  id: number
  topic: string
  status: 'DRAFT' | 'PUBLISHED'
  dueDate: string | null
  recipientCount: number
}

export async function getSessionWorkspace(sessionId: number): Promise<SessionWorkspace> {
  const res = await api.get<SessionWorkspace>(`/v2/teacher/class-schedule/sessions/${sessionId}/workspace`)
  return res.data
}

export async function completeSession(sessionId: number): Promise<SessionWorkspace> {
  const res = await api.post<SessionWorkspace>(`/v2/teacher/class-schedule/sessions/${sessionId}/complete`)
  return res.data
}

export async function uncompleteSession(sessionId: number): Promise<SessionWorkspace> {
  const res = await api.delete<SessionWorkspace>(`/v2/teacher/class-schedule/sessions/${sessionId}/complete`)
  return res.data
}

// ── Mở khóa sửa hồi tố (P07) — phía trung tâm ────────────────────────────────

export interface RecordUnlock {
  id: number
  classId: number
  sessionId: number | null
  grantedTo: number
  grantedBy: number
  reason: string
  grantedAt: string
  expiresAt: string
}

export async function grantRecordUnlock(body: {
  classId: number
  teacherId: number
  sessionId?: number | null
  reason: string
}): Promise<RecordUnlock> {
  const res = await api.post<RecordUnlock>('/org/record-unlocks', body)
  return res.data
}

export async function listActiveRecordUnlocks(classId: number): Promise<RecordUnlock[]> {
  const res = await api.get<RecordUnlock[]>('/org/record-unlocks', { params: { classId } })
  return res.data ?? []
}
