import api from '@/lib/api'
import type { ClassLesson } from '@/lib/teacherLessonsApi'
import type { CurriculumModule } from '@/lib/studentClassesApi'

export type { CurriculumModule }

export async function listModules(classId: number): Promise<CurriculumModule[]> {
  const res = await api.get<CurriculumModule[]>(`/v2/teacher/classes/${classId}/modules`)
  return res.data ?? []
}

export async function createModule(classId: number, title: string): Promise<CurriculumModule> {
  const res = await api.post<CurriculumModule>(`/v2/teacher/classes/${classId}/modules`, { title })
  return res.data
}

export async function updateModule(classId: number, moduleId: number, title: string): Promise<CurriculumModule> {
  const res = await api.patch<CurriculumModule>(`/v2/teacher/classes/${classId}/modules/${moduleId}`, { title })
  return res.data
}

export async function deleteModule(classId: number, moduleId: number): Promise<void> {
  await api.delete(`/v2/teacher/classes/${classId}/modules/${moduleId}`)
}

export async function reorderModules(classId: number, orderedModuleIds: number[]): Promise<CurriculumModule[]> {
  const res = await api.post<CurriculumModule[]>(`/v2/teacher/classes/${classId}/modules/reorder`, { orderedModuleIds })
  return res.data ?? []
}

/** Assign a lesson to a module (moduleId null → ungroup). Returns the updated lesson. */
export async function assignLessonModule(classId: number, lessonId: number, moduleId: number | null): Promise<ClassLesson> {
  const res = await api.patch<ClassLesson>(`/v2/teacher/classes/${classId}/lessons/${lessonId}/module`, { moduleId })
  return res.data
}
