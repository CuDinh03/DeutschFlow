import api from './api'

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
  // Present on the global /v2/students/assignments list (assignment detail);
  // absent (undefined) on the lighter class-scoped list.
  submissionContent?: string | null
  submissionFileUrl?: string | null
  attachmentUrl?: string | null
  referenceId?: number | null
}

export interface SubmitAssignmentPayload {
  submissionContent?: string
  submissionFileUrl?: string
}

export interface ClassLesson {
  id: number
  classId: number
  orderIndex: number
  title: string
  description: string | null
  completed: boolean
  completedAt: string | null
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

export async function joinClassByInviteCode(inviteCode: string): Promise<void> {
  await api.post('/classes/join', { inviteCode })
}

// P5: the class's session schedule (read-only, offline focus per PO — no online link).
export interface ClassSession {
  id: number
  startAt: string
  durationMinutes: number
  mode: 'ONLINE' | 'OFFLINE' | null
  room: string | null
  status: 'SCHEDULED' | 'CANCELLED' | 'MOVED' | null
}

/** The class's session schedule (ordered by time) for the enrolled student. */
export async function fetchClassSessions(classId: number): Promise<ClassSession[]> {
  const res = await api.get<ClassSession[]>(`/v2/students/classes/${classId}/sessions`)
  return res.data ?? []
}

/**
 * Fetch one assignment by its ClassAssignment id. The backend exposes only the
 * full student list (no single-GET), so we mirror the web client and resolve
 * the row client-side. Returns null when the assignment isn't assigned to me.
 */
export async function fetchAssignmentDetail(assignmentId: number): Promise<StudentAssignment | null> {
  const res = await api.get<StudentAssignment[]>('/v2/students/assignments')
  return res.data?.find((a) => a.assignmentId === assignmentId) ?? null
}

/** Submit a written assignment. Backend: PENDING → SUBMITTED (409 if already submitted). */
export async function submitAssignment(
  assignmentId: number,
  payload: SubmitAssignmentPayload,
): Promise<StudentAssignment> {
  const res = await api.post<StudentAssignment>(
    `/v2/students/assignments/${assignmentId}/submit`,
    payload,
  )
  return res.data
}
