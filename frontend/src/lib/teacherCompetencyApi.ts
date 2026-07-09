import api from '@/lib/api'

// Teacher-facing competency overview (Phase 2c): per-can-do mastery across a class's enrolled
// students — the read-side of the ledger (self-assessment + auto-grading), for remediation.

export interface CanDoCompetency {
  canDoStatementId: number
  lessonId: number | null
  lessonTitle: string
  text: string
  skillTag: string | null
  cefrLevel: string | null
  mastered: number
  inProgress: number
}

export interface ClassCompetency {
  enrolledCount: number
  items: CanDoCompetency[]
}

/** GET /v2/teacher/classes/{classId}/competency — the class's per-can-do mastery overview. */
export async function getClassCompetency(classId: number): Promise<ClassCompetency> {
  const res = await api.get<ClassCompetency>(`/v2/teacher/classes/${classId}/competency`)
  return res.data
}
