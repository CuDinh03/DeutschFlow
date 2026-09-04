import api from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Phân bổ nội dung theo buổi (PR-4, AC06–AC08) — /api/v2/teacher/class-schedule/
// sessions/{id}/contents. PUT thay TOÀN BỘ dòng PLANNED thường của buổi (dòng đã
// xác nhận + dòng chuyển tiếp được BE giữ nguyên); POST /confirm ghi kết quả thực tế.
// ─────────────────────────────────────────────────────────────────────────────

export type SessionContentStatus = 'PLANNED' | 'TAUGHT' | 'PARTIAL'

export interface SessionContent {
  id: number
  sessionId: number
  classLessonId: number
  lessonTitle: string
  /** Mục giáo trình (null = phần tự do của bài). */
  curriculumItemId: number | null
  itemText: string | null
  orderIndex: number
  plannedMinutes: number | null
  status: SessionContentStatus
  actualMinutes: number | null
  remainingMinutes: number | null
  /** Khác null = dòng CHUYỂN TIẾP phần dở từ buổi trước (đứng đầu buổi, AC06). */
  carriedFromId: number | null
  confirmedAt: string | null
  note: string | null
}

export interface SessionContents {
  sessionId: number
  /** Phút HỌC của buổi (D04) — khung để phân bổ, không tính giải lao. */
  teachingMinutes: number
  plannedTotalMinutes: number
  /** Tổng phút phần dở KHÔNG còn buổi kế để bố trí — hiện cảnh báo, không nuốt. */
  unallocatedCarryMinutes: number
  contents: SessionContent[]
}

export interface PlanEntry {
  classLessonId: number
  curriculumItemId?: number | null
  plannedMinutes: number
  note?: string | null
}

export interface ConfirmEntry {
  contentId: number
  status: SessionContentStatus
  actualMinutes?: number | null
  /** Bắt buộc có ý nghĩa khi PARTIAL — phút ƯỚC TÍNH còn lại chuyển sang buổi kế. */
  remainingMinutes?: number | null
  note?: string | null
}

export async function getSessionContents(sessionId: number): Promise<SessionContents> {
  const res = await api.get<SessionContents>(`/v2/teacher/class-schedule/sessions/${sessionId}/contents`)
  return res.data
}

export async function planSessionContents(sessionId: number, items: PlanEntry[]): Promise<SessionContents> {
  const res = await api.put<SessionContents>(`/v2/teacher/class-schedule/sessions/${sessionId}/contents`, { items })
  return res.data
}

export async function confirmSessionContents(sessionId: number, entries: ConfirmEntry[]): Promise<SessionContents> {
  const res = await api.post<SessionContents>(`/v2/teacher/class-schedule/sessions/${sessionId}/contents/confirm`, { entries })
  return res.data
}

/** Mục bắt buộc của Lektion mà bài giáo trình sinh từ — nguồn chọn khi phân bổ. */
export interface LessonCurriculumItem {
  id: number
  orderIndex: number
  text: string
  skillTag: string | null
  contentTag: string | null
  estimatedMinutes: number | null
}

export async function listLessonCurriculumItems(classId: number, lessonId: number): Promise<LessonCurriculumItem[]> {
  const res = await api.get<LessonCurriculumItem[]>(`/v2/teacher/classes/${classId}/lessons/${lessonId}/curriculum-items`)
  return res.data ?? []
}
