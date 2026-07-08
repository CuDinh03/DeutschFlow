import api from '@/lib/api'
import type { ClassLesson, KnowledgePoint, CanDoStatement } from '@/lib/studentClassesApi'

export type { ClassLesson, KnowledgePoint, CanDoStatement }

/** One knowledge point in a create/update payload (skill/content tags optional). */
export interface KnowledgePointInput {
  text: string
  skillTag?: string | null
  contentTag?: string | null
}

/** One Kann-Beschreibung in a create/update payload (Phase 1e; cefr/skill optional). */
export interface CanDoStatementInput {
  text: string
  cefrLevel?: string | null
  skillTag?: string | null
}

export async function listLessons(classId: number): Promise<ClassLesson[]> {
  const res = await api.get<ClassLesson[]>(`/v2/teacher/classes/${classId}/lessons`)
  return res.data ?? []
}

export interface LessonWriteFields {
  cefrLevel?: string | null
  plannedDate?: string | null
  estimatedUnits?: number | null
  /** Structured points (Phase 1b). When present, the server treats this as canonical and
   *  re-derives `description` from it. Send [] to clear all points. */
  knowledgePoints?: KnowledgePointInput[]
  /** Kann-Beschreibung statements (Phase 1e). Non-null replaces; [] clears; omit to leave as-is. */
  canDoStatements?: CanDoStatementInput[]
}

export async function createLesson(
  classId: number,
  data: { title: string; description?: string } & LessonWriteFields,
): Promise<ClassLesson> {
  const res = await api.post<ClassLesson>(`/v2/teacher/classes/${classId}/lessons`, data)
  return res.data
}

/** Update-only flags to clear an optional field back to null (value null = leave unchanged). */
export interface LessonClearFlags {
  clearCefrLevel?: boolean
  clearPlannedDate?: boolean
  clearEstimatedUnits?: boolean
}

export async function updateLesson(
  classId: number,
  lessonId: number,
  data: { title?: string; description?: string; completed?: boolean } & LessonWriteFields & LessonClearFlags,
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
