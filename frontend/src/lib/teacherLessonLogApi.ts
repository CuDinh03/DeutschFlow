import api from '@/lib/api'

export interface LessonLogAttendanceEntry {
  studentId: number
  name: string
  email: string
  status: string
  note: string | null
  /** AC13 (PR-7): vắng → "cần bù riêng" (mặc định bật khi ABSENT; giáo viên bỏ được). */
  needsMakeup: boolean
}

export interface ClassLessonLog {
  id: number
  classId: number
  sessionDate: string
  sessionNumber: number | null
  topic: string | null
  homework: string | null
  note: string | null
  createdAt: string
  attendance: LessonLogAttendanceEntry[]
  /** Optional link to the taught ClassLesson (Phase 1d-D3). */
  lessonId?: number | null
  lessonTitle?: string | null
  /** PR-4 (AC05): buổi lịch mà nhật ký này thuộc về; null = nhật ký legacy theo ngày. */
  sessionId?: number | null
}

export interface LessonLogAttendanceInput {
  studentId: number
  status: string
  note?: string | null
  /** null/bỏ trống = tự suy theo trạng thái (ABSENT → cần bù riêng, AC13). */
  needsMakeup?: boolean | null
}

export interface LessonLogRequest {
  sessionDate: string
  sessionNumber?: number | null
  topic?: string | null
  homework?: string | null
  note?: string | null
  attendance?: LessonLogAttendanceInput[]
  lessonId?: number | null
  sessionId?: number | null
  /** PR-7 (P07): lý do sửa hồi tố — lưu vào lịch sử; tùy chọn. */
  editReason?: string | null
}

export async function listLessonLogs(classId: number): Promise<ClassLessonLog[]> {
  const res = await api.get<ClassLessonLog[]>(`/v2/teacher/classes/${classId}/lesson-logs`)
  return res.data ?? []
}

export async function createLessonLog(classId: number, data: LessonLogRequest): Promise<ClassLessonLog> {
  const res = await api.post<ClassLessonLog>(`/v2/teacher/classes/${classId}/lesson-logs`, data)
  return res.data
}

export async function updateLessonLog(classId: number, logId: number, data: LessonLogRequest): Promise<ClassLessonLog> {
  const res = await api.put<ClassLessonLog>(`/v2/teacher/classes/${classId}/lesson-logs/${logId}`, data)
  return res.data
}

export async function deleteLessonLog(classId: number, logId: number): Promise<void> {
  await api.delete(`/v2/teacher/classes/${classId}/lesson-logs/${logId}`)
}
