import api from '@/lib/api'

export interface TeacherSummary {
  id: number
  displayName: string
  email: string
  role: string
}

export interface MyClassroom {
  id: number
  name: string
  teachers: TeacherSummary[]
  assignmentCount: number
  pendingCount: number
  submittedCount: number
  gradedCount: number
  avgScore: number | null
  latestAssignmentTopic: string | null
  latestAssignmentDueDate: string | null
  lessonTotal: number
  lessonCompleted: number
  joinedAt: string | null
}

export interface ClassroomDetail {
  id: number
  name: string
  inviteCode: string
  teachers: TeacherSummary[]
  studentCount: number
  assignmentCount: number
  pendingCount: number
  submittedCount: number
  gradedCount: number
  avgScore: number | null
  lessonTotal: number
  lessonCompleted: number
  currentLessonTitle: string | null
  joinedAt: string | null
  createdAt: string
}

export interface StudentAssignment {
  id: number
  assignmentId: number
  studentId: number
  status: string
  teacherScore: number | null
  teacherFeedback: string | null
  submittedAt: string | null
  createdAt: string
  topic: string
  description: string
  assignmentType: string
  dueDate: string | null
  submissionContent: string | null
  submissionFileUrl: string | null
  attachmentUrl: string | null
  referenceId: number | null
}

export interface KnowledgePoint {
  id: number | null
  orderIndex: number
  text: string
  /** HOEREN | LESEN | SCHREIBEN | SPRECHEN, or null. */
  skillTag: string | null
  /** WORTSCHATZ | GRAMMATIK | AUSSPRACHE | LANDESKUNDE | REDEMITTEL | STRATEGIE, or null. */
  contentTag: string | null
}

export interface CurriculumModule {
  id: number
  classId: number
  orderIndex: number
  title: string
}

/** A lesson's Kann-Beschreibung ("Ich kann …") competency target (Phase 1e). */
export interface CanDoStatement {
  id: number | null
  orderIndex: number
  /** A1..C2, or null. */
  cefrLevel: string | null
  /** HOEREN | LESEN | SCHREIBEN | SPRECHEN, or null. */
  skillTag: string | null
  text: string
}

export interface ClassLesson {
  id: number
  classId: number
  orderIndex: number
  /** Curriculum module this lesson belongs to; null = ungrouped (Phase 1c). */
  moduleId: number | null
  title: string
  description: string | null
  /** Structured knowledge points (Phase 1b); may be empty (then fall back to description). */
  knowledgePoints: KnowledgePoint[]
  /** Kann-Beschreibung competency targets (Phase 1e); may be empty. */
  canDoStatements: CanDoStatement[]
  /** CEFR level of the lesson (A1..C2); null when unset. */
  cefrLevel: string | null
  /** Planned teaching date (ISO yyyy-MM-dd); compared with completion for pacing. */
  plannedDate: string | null
  /** Estimated 45-min teaching units; null when unset. */
  estimatedUnits: number | null
  completed: boolean
  completedAt: string | null
  completedByTeacherId: number | null
  createdAt: string
  updatedAt: string
}

export async function fetchMyClasses(): Promise<MyClassroom[]> {
  const res = await api.get<MyClassroom[]>('/v2/students/classes')
  return res.data ?? []
}

export async function fetchClassDetail(classId: number): Promise<ClassroomDetail> {
  const res = await api.get<ClassroomDetail>(`/v2/students/classes/${classId}`)
  return res.data
}

export async function fetchClassAssignments(classId: number): Promise<StudentAssignment[]> {
  const res = await api.get<StudentAssignment[]>(`/v2/students/classes/${classId}/assignments`)
  return res.data ?? []
}

export async function fetchClassLessons(classId: number): Promise<ClassLesson[]> {
  const res = await api.get<ClassLesson[]>(`/v2/students/classes/${classId}/lessons`)
  return res.data ?? []
}

export async function fetchClassModules(classId: number): Promise<CurriculumModule[]> {
  const res = await api.get<CurriculumModule[]>(`/v2/students/classes/${classId}/modules`)
  return res.data ?? []
}

export async function joinClassByInviteCode(inviteCode: string): Promise<void> {
  await api.post('/classes/join', { inviteCode })
}
