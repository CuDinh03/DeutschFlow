import api from '@/lib/api'

export interface GradebookCell {
  status: string
  score: number | null
  submittedAt: string | null
}

export interface GradebookAssignment {
  id: number
  topic: string
  assignmentType: string
  skill: string | null
  dueDate: string | null
}

export interface GradebookStudent {
  studentId: number
  name: string
  email: string
  avgScore: number | null
  cells: Record<string, GradebookCell>
}

export interface Gradebook {
  classId: number
  className: string
  assignments: GradebookAssignment[]
  students: GradebookStudent[]
}

export async function getGradebook(classId: number): Promise<Gradebook> {
  const res = await api.get<Gradebook>(`/v2/teacher/reports/classes/${classId}/gradebook`)
  return res.data
}

export interface SkillReportRow {
  studentId: number
  name: string
  email: string
  horen: number | null
  lesen: number | null
  schreiben: number | null
  sprechen: number | null
  total: number | null
  grade: string
}

export interface SkillReport {
  classId: number
  className: string
  students: SkillReportRow[]
}

export async function getSkillReport(classId: number): Promise<SkillReport> {
  const res = await api.get<SkillReport>(`/v2/teacher/reports/classes/${classId}/skill-report`)
  return res.data
}
