import api from '@/lib/api'

export interface StudentEvaluation {
  studentId: number
  name: string
  email: string
  classId: number
  className: string
  teacherComment: string | null
  skillHoren: number | null
  skillLesen: number | null
  skillSchreiben: number | null
  skillSprechen: number | null
  avgScore: number | null
  /** Buổi CÓ ghi nhận điểm danh cho chính học viên này — mẫu số của tỉ lệ chuyên cần. */
  recordedSessions: number
  presentCount: number
  absentCount: number
  lateCount: number
  certificateEligible: boolean
  evaluatedAt: string | null
}

export interface StudentEvaluationInput {
  teacherComment?: string | null
  skillHoren?: number | null
  skillLesen?: number | null
  skillSchreiben?: number | null
  skillSprechen?: number | null
}

export async function listEvaluations(classId: number): Promise<StudentEvaluation[]> {
  const res = await api.get<StudentEvaluation[]>(`/v2/teacher/classes/${classId}/evaluations`)
  return res.data ?? []
}

export async function saveEvaluation(
  classId: number,
  studentId: number,
  data: StudentEvaluationInput,
): Promise<StudentEvaluation> {
  const res = await api.put<StudentEvaluation>(`/v2/teacher/classes/${classId}/evaluations/${studentId}`, data)
  return res.data
}
