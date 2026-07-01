import * as FileSystem from 'expo-file-system/legacy'
import api from './api'

// Max upload size mirrors the web client (backend/S3 also bound this). Keep in sync.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export interface UploadFile {
  uri: string
  name: string
  contentType: string
}

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

// P4: the student's OWN evaluation data. Backend enforces own-data-only + never the class list.
export interface StudentAttendance {
  lessonLogId: number
  sessionDate: string
  sessionNumber: number | null
  topic: string | null
  status: 'PRESENT' | 'ABSENT' | 'LATE' | null
  note: string | null
}

export interface MySkillReport {
  horen: number | null
  lesen: number | null
  schreiben: number | null
  sprechen: number | null
  total: number | null
  grade: string
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

/** The student's own attendance for a class (one row per session, status null when unmarked). */
export async function fetchMyAttendance(classId: number): Promise<StudentAttendance[]> {
  const res = await api.get<StudentAttendance[]>(`/v2/students/classes/${classId}/my-attendance`)
  return res.data ?? []
}

/** The student's own 4-skill report row (never the class list). */
export async function fetchMySkillReport(classId: number): Promise<MySkillReport> {
  const res = await api.get<MySkillReport>(`/v2/students/classes/${classId}/my-skill-report`)
  return res.data
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

/**
 * Upload an assignment attachment (image / PDF / Word / audio) to S3 and return the stored URL.
 * Mirrors the web flow: ask the backend for a presigned PUT URL bound to the file's contentType,
 * PUT the bytes straight to S3, then return the object URL (presigned URL minus its query string)
 * — that URL is what {@link submitAssignment} stores as `submissionFileUrl`.
 * Throws with a clear message on validation / network / S3 failure.
 */
export async function uploadAssignmentFile(
  assignmentId: number,
  file: UploadFile,
): Promise<string> {
  const presign = await api.get<{ url: string; objectKey: string }>(
    '/v2/students/assignments/presigned-url',
    { params: { assignmentId, filename: file.name, contentType: file.contentType } },
  )
  const { url } = presign.data
  if (!url) throw new Error('Không lấy được đường dẫn tải lên')

  const res = await FileSystem.uploadAsync(url, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': file.contentType },
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Tải file lên thất bại (S3 ${res.status})`)
  }

  // The object is now at the presigned URL without its query params (mirrors the web client).
  return url.split('?')[0]
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
