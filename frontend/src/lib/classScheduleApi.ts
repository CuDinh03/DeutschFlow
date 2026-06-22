import api from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Lịch buổi lớp (Pha 2) — /api/v2/teacher/class-schedule/*.
// Thời gian gửi/nhận là wall-clock LocalDateTime (KHÔNG offset, không "Z") để khớp
// cột TIMESTAMP của backend; dùng fmtLocalIso() cho khoảng tuần, còn input
// datetime-local đã ở đúng định dạng này.
// ─────────────────────────────────────────────────────────────────────────────

export type ClassMode = 'ONLINE' | 'OFFLINE'
export type ClassSessionStatus = 'SCHEDULED' | 'CANCELLED' | 'MOVED'

export interface ClassSession {
  id: number
  classId: number
  className: string
  patternId: number | null
  mode: ClassMode
  room: string | null
  startAt: string
  durationMinutes: number
  status: ClassSessionStatus
  overridden: boolean
  studentCount: number
}

export interface SessionSaveResult {
  session: ClassSession
  roomWarnings: string[]
}

export interface ClassSchedulePattern {
  id: number
  classId: number
  dayOfWeek: number
  startTime: string
  durationMinutes: number
  defaultMode: ClassMode
  defaultRoom: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export interface UpsertPatternResult {
  patternId: number
  generated: number
  keptOverridden: number
}

export interface TeacherClassLite {
  id: number
  name: string
  studentCount: number
}

/** Format a Date as local wall-clock ISO (no offset), e.g. 2026-06-23T00:00:00. */
export function fmtLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export async function getClassWeek(fromISO: string, toISO: string): Promise<ClassSession[]> {
  const res = await api.get<ClassSession[]>('/v2/teacher/class-schedule/week', {
    params: { from: fromISO, to: toISO },
  })
  return res.data
}

export interface CreateSessionBody {
  startAt: string
  durationMinutes: number
  mode: ClassMode
  room: string | null
}

export async function createClassSession(classId: number, body: CreateSessionBody): Promise<SessionSaveResult> {
  const res = await api.post<SessionSaveResult>(`/v2/teacher/class-schedule/classes/${classId}/sessions`, body)
  return res.data
}

export interface UpdateSessionBody {
  startAt?: string
  durationMinutes?: number
  mode?: ClassMode
  room?: string | null
  status?: ClassSessionStatus
}

export async function updateClassSession(id: number, body: UpdateSessionBody): Promise<SessionSaveResult> {
  const res = await api.patch<SessionSaveResult>(`/v2/teacher/class-schedule/sessions/${id}`, body)
  return res.data
}

export async function getClassPatterns(classId: number): Promise<ClassSchedulePattern[]> {
  const res = await api.get<ClassSchedulePattern[]>(`/v2/teacher/class-schedule/classes/${classId}/patterns`)
  return res.data
}

export interface UpsertPatternBody {
  dayOfWeek: number
  startTime: string
  durationMinutes: number
  defaultMode: ClassMode
  defaultRoom: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export async function upsertClassPattern(classId: number, body: UpsertPatternBody): Promise<UpsertPatternResult> {
  const res = await api.put<UpsertPatternResult>(`/v2/teacher/class-schedule/classes/${classId}/pattern`, body)
  return res.data
}

export async function deleteClassPattern(patternId: number): Promise<number> {
  const res = await api.delete<number>(`/v2/teacher/class-schedule/patterns/${patternId}`)
  return res.data
}

interface TeacherClassRaw {
  id: number
  name: string
  studentCount: number
}

/** Danh sách lớp giáo viên dạy (cho picker khi thêm buổi / đặt lịch cố định). */
export async function getMyClasses(): Promise<TeacherClassLite[]> {
  const res = await api.get<TeacherClassRaw[]>('/v2/teacher/classes')
  return (res.data ?? []).map((c) => ({ id: c.id, name: c.name, studentCount: c.studentCount }))
}
