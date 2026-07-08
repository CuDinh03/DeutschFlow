import api from '@/lib/api'

/**
 * Persisted teaching materials (B2B model §5/§6). Distinct from the throwaway PPTX generator.
 * Paths are relative to the axios `baseURL` (`<origin>/api`).
 */

export type MaterialScope = 'PERSONAL' | 'ORG'
export type MaterialKind = 'PPTX' | 'PDF' | 'DOCX' | 'IMAGE' | 'OTHER'
export type MaterialStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED'

export interface Material {
  id: number
  ownerScope: MaterialScope
  title: string
  description: string | null
  kind: MaterialKind
  url: string
  mimeType: string | null
  sizeBytes: number | null
  visibility: string
  status: MaterialStatus
  createdBy: number
  createdAt: string
}

/** GET /v2/materials — PERSONAL of the caller ∪ ORG of the caller's org (ACTIVE membership). */
export async function listMaterials(): Promise<Material[]> {
  const res = await api.get<Material[]>('/v2/materials')
  return res.data ?? []
}

/** POST /v2/materials — upload a PERSONAL or ORG material. */
export async function uploadMaterial(
  file: File,
  title: string,
  scope: MaterialScope,
  description?: string,
): Promise<Material> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title)
  fd.append('scope', scope)
  if (description) fd.append('description', description)
  const res = await api.post<Material>('/v2/materials', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

/** POST /v2/materials/{id}/archive — soft-archive (status → ARCHIVED). */
export async function archiveMaterial(id: number): Promise<Material> {
  const res = await api.post<Material>(`/v2/materials/${id}/archive`)
  return res.data
}

/** GET /v2/materials/class/{classId} — materials attached to a class. */
export async function listClassMaterials(classId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/v2/materials/class/${classId}`)
  return res.data ?? []
}

/** POST /v2/materials/{id}/classes/{classId} — attach a material to a class. */
export async function attachMaterialToClass(materialId: number, classId: number): Promise<void> {
  await api.post(`/v2/materials/${materialId}/classes/${classId}`)
}

/** GET /v2/materials/lesson/{lessonId} — active materials attached to a lesson, in order (Phase 1d-D2). */
export async function listLessonMaterials(lessonId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/v2/materials/lesson/${lessonId}`)
  return res.data ?? []
}

/** POST /v2/materials/{id}/lessons/{lessonId} — attach a material to a lesson. */
export async function attachMaterialToLesson(materialId: number, lessonId: number): Promise<void> {
  await api.post(`/v2/materials/${materialId}/lessons/${lessonId}`)
}

/** DELETE /v2/materials/{id}/lessons/{lessonId} — detach a material from a lesson. */
export async function detachMaterialFromLesson(materialId: number, lessonId: number): Promise<void> {
  await api.delete(`/v2/materials/${materialId}/lessons/${lessonId}`)
}
