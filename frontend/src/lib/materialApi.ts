import api from '@/lib/api'

/**
 * Persisted teaching materials (B2B model §5/§6). Distinct from the throwaway PPTX generator.
 * Paths are relative to the axios `baseURL` (`<origin>/api`).
 */

export type MaterialScope = 'PERSONAL' | 'ORG'
export type MaterialKind = 'PPTX' | 'PDF' | 'DOCX' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'LINK' | 'OTHER'
export type MaterialStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED' | 'UPLOADING'

export interface Material {
  id: number
  ownerScope: MaterialScope
  title: string
  description: string | null
  kind: MaterialKind
  /** Presigned GET for file materials; the raw external link for kind=LINK. */
  url: string
  /** kind=LINK only: the external source URL (allango/YouTube/Drive…). */
  externalUrl: string | null
  /** Folder the material is filed under, or null when unfiled (root). */
  folderId: number | null
  /** Audio/video track length in seconds (allango-style display), or null. */
  durationSeconds: number | null
  /** Free-form tags for filtering ("Netzwerk A1", "Hören", …). */
  tags: string[]
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

/** GET /v2/materials/archived — the "Đã lưu trữ" filter, so archiving is reversible + discoverable. */
export async function listArchivedMaterials(): Promise<Material[]> {
  const res = await api.get<Material[]>('/v2/materials/archived')
  return res.data ?? []
}

/** POST /v2/materials/{id}/unarchive — restore an archived material (reappears in its lessons). */
export async function unarchiveMaterial(id: number): Promise<Material> {
  const res = await api.post<Material>(`/v2/materials/${id}/unarchive`)
  return res.data
}

/** How many lessons/classes/assignments a material is attached to — read before archiving to warn the user. */
export interface AttachmentCount {
  lessons: number
  classes: number
  assignments: number
}
export async function fetchMaterialAttachments(id: number): Promise<AttachmentCount> {
  const res = await api.get<AttachmentCount>(`/v2/materials/${id}/attachments`)
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

/** GET /v2/materials/assignment/{assignmentId} — materials attached to an assignment (teacher view). */
export async function listAssignmentMaterials(assignmentId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/v2/materials/assignment/${assignmentId}`)
  return res.data ?? []
}

/** POST /v2/materials/{id}/assignments/{assignmentId} — attach a library material to an assignment. */
export async function attachMaterialToAssignment(materialId: number, assignmentId: number): Promise<void> {
  await api.post(`/v2/materials/${materialId}/assignments/${assignmentId}`)
}

/** DELETE /v2/materials/{id}/assignments/{assignmentId} — detach a material from an assignment. */
export async function detachMaterialFromAssignment(materialId: number, assignmentId: number): Promise<void> {
  await api.delete(`/v2/materials/${materialId}/assignments/${assignmentId}`)
}
