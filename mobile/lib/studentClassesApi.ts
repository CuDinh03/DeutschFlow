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
