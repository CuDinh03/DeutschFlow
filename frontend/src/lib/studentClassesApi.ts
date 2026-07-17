import api from '@/lib/api'
import type { Material } from '@/lib/materialApi'

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

// ── Lesson materials (student read) ──────────────────────────────────────────
// The teacher attaches materials to a lesson; these two endpoints are the ONLY way a student reaches
// them (the whole /v2/materials surface is teacher/admin-gated). Access is by enrollment in the class.

/** Materials the teacher attached to a lesson, for a student enrolled in the class. */
export async function fetchLessonMaterials(lessonId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/v2/students/classes/lessons/${lessonId}/materials`)
  return res.data ?? []
}

/** A fresh resolvable URL for a lesson material (the presigned GET link expires after ~1h). */
export async function fetchLessonMaterialUrl(lessonId: number, materialId: number): Promise<string> {
  const res = await api.get<{ url: string }>(
    `/v2/students/classes/lessons/${lessonId}/materials/${materialId}/url`,
  )
  return res.data.url
}

// ── Assignment materials (student read) ──────────────────────────────────────
// The teacher attaches library materials when giving the assignment; these two endpoints are the ONLY
// way a student reaches them. Access is by having been GIVEN the assignment, enforced server-side.

/** Materials the teacher attached to an assignment, for the student it was handed to. */
export async function fetchAssignmentMaterials(assignmentId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/v2/students/assignments/${assignmentId}/materials`)
  return res.data ?? []
}

/** A fresh resolvable URL for an assignment material (the presigned GET link expires after ~1h). */
export async function fetchAssignmentMaterialUrl(assignmentId: number, materialId: number): Promise<string> {
  const res = await api.get<{ url: string }>(
    `/v2/students/assignments/${assignmentId}/materials/${materialId}/url`,
  )
  return res.data.url
}

// ── Competency ledger / Selbstevaluation (Phase 2a) ──────────────────────────

export type CompetencyStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'MASTERED'
/** Origin of a competency status: student self-report, auto from grading, or auto from SRS. */
export type CompetencySource = 'SELF' | 'GRADING' | 'SRS'

/** A student's competency status for one can-do statement (self-reported or auto-derived). */
export interface StudentCompetency {
  canDoStatementId: number
  status: CompetencyStatus
  source?: CompetencySource
}

/** GET the student's OWN competency statuses for this class's can-dos. Missing = NOT_STARTED. */
export async function fetchClassCompetency(classId: number): Promise<StudentCompetency[]> {
  const res = await api.get<StudentCompetency[]>(`/v2/students/classes/${classId}/competency`)
  return res.data ?? []
}

/** PUT the student's self-assessment of one can-do (upsert). */
export async function setCompetency(
  classId: number,
  canDoStatementId: number,
  status: CompetencyStatus,
): Promise<StudentCompetency> {
  const res = await api.put<StudentCompetency>(
    `/v2/students/classes/${classId}/competency/${canDoStatementId}`,
    { status },
  )
  return res.data
}
