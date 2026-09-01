import api from '@/lib/api'

// Mốc của lớp (V295, PR-6): thi chính thức + kết thúc khóa. Lớp trung tâm đã gắn
// giáo trình: DỜI ngày trở thành đề xuất chờ duyệt (pendingRequestId — P05).

export interface ClassMilestone {
  id: number
  classId: number
  kind: 'EXAM' | 'COURSE_END'
  title: string
  plannedDate: string
  note: string | null
  /** Khác null = việc dời ngày vừa vào hàng chờ duyệt — ngày hiển thị CHƯA đổi. */
  pendingRequestId: number | null
}

export interface UpsertMilestoneBody {
  kind?: 'EXAM' | 'COURSE_END'
  title?: string
  plannedDate?: string
  note?: string | null
}

export async function listMilestones(classId: number): Promise<ClassMilestone[]> {
  const res = await api.get<ClassMilestone[]>(`/v2/teacher/classes/${classId}/milestones`)
  return res.data ?? []
}

export async function createMilestone(classId: number, body: UpsertMilestoneBody): Promise<ClassMilestone> {
  const res = await api.post<ClassMilestone>(`/v2/teacher/classes/${classId}/milestones`, body)
  return res.data
}

export async function updateMilestone(
  classId: number,
  milestoneId: number,
  body: UpsertMilestoneBody,
): Promise<ClassMilestone> {
  const res = await api.patch<ClassMilestone>(`/v2/teacher/classes/${classId}/milestones/${milestoneId}`, body)
  return res.data
}

export async function deleteMilestone(classId: number, milestoneId: number): Promise<void> {
  await api.delete(`/v2/teacher/classes/${classId}/milestones/${milestoneId}`)
}
