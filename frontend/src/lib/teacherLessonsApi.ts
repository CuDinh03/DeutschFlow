import api from '@/lib/api'
import type { ClassLesson } from '@/lib/studentClassesApi'

export type { ClassLesson }

export async function listLessons(classId: number): Promise<ClassLesson[]> {
  const res = await api.get<ClassLesson[]>(`/v2/teacher/classes/${classId}/lessons`)
  return res.data ?? []
}

export async function createLesson(
  classId: number,
  data: { title: string; description?: string },
): Promise<ClassLesson> {
  const res = await api.post<ClassLesson>(`/v2/teacher/classes/${classId}/lessons`, data)
  return res.data
}

export async function updateLesson(
  classId: number,
  lessonId: number,
  data: { title?: string; description?: string; completed?: boolean },
): Promise<ClassLesson> {
  const res = await api.patch<ClassLesson>(`/v2/teacher/classes/${classId}/lessons/${lessonId}`, data)
  return res.data
}

export async function deleteLesson(classId: number, lessonId: number): Promise<void> {
  await api.delete(`/v2/teacher/classes/${classId}/lessons/${lessonId}`)
}

export async function reorderLessons(
  classId: number,
  orderedLessonIds: number[],
): Promise<ClassLesson[]> {
  const res = await api.post<ClassLesson[]>(`/v2/teacher/classes/${classId}/lessons/reorder`, {
    orderedLessonIds,
  })
  return res.data ?? []
}
