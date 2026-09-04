import api from '@/lib/api'

/**
 * Giáo trình trung tâm (PR-1, quyết định P03) — org-admin (OWNER/MANAGER) soạn/nhập bộ giáo
 * trình, quản lý phiên bản DRAFT→PUBLISHED→ARCHIVED và gán phiên bản PUBLISHED cho lớp.
 * PUBLISHED là bất biến: sửa nội dung = tạo bản nháp mới.
 */

export type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface CurriculumItem {
  id: number
  orderIndex: number
  text: string
  skillTag: string | null
  contentTag: string | null
  estimatedMinutes: number | null
}

export interface CurriculumObjective {
  id: number
  orderIndex: number
  text: string
  cefrLevel: string | null
  skillTag: string | null
}

export interface CurriculumLektion {
  id: number
  orderIndex: number
  title: string
  description: string | null
  items: CurriculumItem[]
  objectives: CurriculumObjective[]
}

export interface CurriculumVersionSummary {
  id: number
  versionNo: number
  status: VersionStatus
  lektionCount: number
  publishedAt: string | null
  linkedClassCount: number
}

export interface OrgCurriculumSummary {
  id: number
  name: string
  cefrLevel: string | null
  description: string | null
  sample: boolean
  createdAt: string
  versions: CurriculumVersionSummary[]
}

export interface CurriculumVersionDetail {
  id: number
  curriculumId: number
  curriculumName: string
  curriculumCefrLevel: string | null
  versionNo: number
  status: VersionStatus
  sourceNote: string | null
  publishedAt: string | null
  linkedClassCount: number
  lektionen: CurriculumLektion[]
}

export interface CurriculumItemInput {
  text: string
  skillTag?: string | null
  contentTag?: string | null
  estimatedMinutes?: number | null
}

export interface CurriculumObjectiveInput {
  text: string
  cefrLevel?: string | null
  skillTag?: string | null
}

export interface ImportLektionInput {
  title: string
  description?: string | null
  items: CurriculumItemInput[]
  objectives: CurriculumObjectiveInput[]
}

export interface ClassCurriculumLink {
  classId: number
  curriculumId: number
  curriculumName: string
  versionId: number
  versionNo: number
  versionStatus: VersionStatus
  assignedAt: string
}

/** Tác động gán/đổi/gỡ — hiển thị trong ConfirmDialog trước khi thao tác (plan §2.11). */
export interface CurriculumAssignmentImpact {
  currentVersionId: number | null
  targetVersionId: number | null
  generatedLessonCount: number
  logCount: number
  assignmentCount: number
  completedLessonCount: number
  competencyRecordCount: number
  canApply: boolean
}

export async function listCurricula(): Promise<OrgCurriculumSummary[]> {
  const res = await api.get<OrgCurriculumSummary[]>('/org/curricula')
  return res.data
}

export async function createCurriculum(body: {
  name: string
  cefrLevel?: string | null
  description?: string | null
}): Promise<OrgCurriculumSummary> {
  const res = await api.post<OrgCurriculumSummary>('/org/curricula', body)
  return res.data
}

/** Nhập bộ giáo trình thật thành bản nháp (P03): nhập → trung tâm kiểm tra → công bố → gán lớp. */
export async function importCurriculum(body: {
  name: string
  cefrLevel?: string | null
  description?: string | null
  sourceNote?: string | null
  lektionen: ImportLektionInput[]
}): Promise<OrgCurriculumSummary> {
  const res = await api.post<OrgCurriculumSummary>('/org/curricula/import', body)
  return res.data
}

/** Bộ mẫu A1 tự soạn (sample=true) — chỉ để chạy thử luồng vận hành. */
export async function createSampleCurriculum(): Promise<OrgCurriculumSummary> {
  const res = await api.post<OrgCurriculumSummary>('/org/curricula/sample')
  return res.data
}

export async function updateCurriculumMeta(
  curriculumId: number,
  body: { name?: string; cefrLevel?: string; description?: string },
): Promise<void> {
  await api.patch(`/org/curricula/${curriculumId}`, body)
}

export async function deleteCurriculum(curriculumId: number): Promise<void> {
  await api.delete(`/org/curricula/${curriculumId}`)
}

export async function createVersion(
  curriculumId: number,
  sourceVersionId?: number,
): Promise<CurriculumVersionDetail> {
  const res = await api.post<CurriculumVersionDetail>(
    `/org/curricula/${curriculumId}/versions`,
    sourceVersionId ? { sourceVersionId } : {},
  )
  return res.data
}

export async function getVersionDetail(versionId: number): Promise<CurriculumVersionDetail> {
  const res = await api.get<CurriculumVersionDetail>(`/org/curriculum-versions/${versionId}`)
  return res.data
}

export async function publishVersion(versionId: number): Promise<void> {
  await api.post(`/org/curriculum-versions/${versionId}/publish`)
}

export async function archiveVersion(versionId: number): Promise<void> {
  await api.post(`/org/curriculum-versions/${versionId}/archive`)
}

export async function deleteVersion(versionId: number): Promise<void> {
  await api.delete(`/org/curriculum-versions/${versionId}`)
}

export async function addLektion(
  versionId: number,
  body: { title: string; description?: string | null },
): Promise<CurriculumLektion> {
  const res = await api.post<CurriculumLektion>(`/org/curriculum-versions/${versionId}/lektionen`, body)
  return res.data
}

export async function reorderLektionen(
  versionId: number,
  orderedLektionIds: number[],
): Promise<CurriculumLektion[]> {
  const res = await api.post<CurriculumLektion[]>(
    `/org/curriculum-versions/${versionId}/lektionen/reorder`,
    { orderedLektionIds },
  )
  return res.data
}

export async function updateLektion(
  lektionId: number,
  body: { title?: string; description?: string | null },
): Promise<CurriculumLektion> {
  const res = await api.patch<CurriculumLektion>(`/org/curriculum-lektionen/${lektionId}`, body)
  return res.data
}

export async function deleteLektion(lektionId: number): Promise<void> {
  await api.delete(`/org/curriculum-lektionen/${lektionId}`)
}

export async function replaceItems(
  lektionId: number,
  items: CurriculumItemInput[],
): Promise<CurriculumItem[]> {
  const res = await api.put<CurriculumItem[]>(`/org/curriculum-lektionen/${lektionId}/items`, { items })
  return res.data
}

export async function replaceObjectives(
  lektionId: number,
  objectives: CurriculumObjectiveInput[],
): Promise<CurriculumObjective[]> {
  const res = await api.put<CurriculumObjective[]>(
    `/org/curriculum-lektionen/${lektionId}/objectives`,
    { objectives },
  )
  return res.data
}

/** Link hiện tại của lớp; 204 → null. */
export async function getClassCurriculumLink(classId: number): Promise<ClassCurriculumLink | null> {
  const res = await api.get<ClassCurriculumLink | ''>(`/org/classes/${classId}/curriculum`)
  return res.status === 204 || res.data === '' ? null : (res.data as ClassCurriculumLink)
}

export async function getAssignmentImpact(
  classId: number,
  versionId?: number,
): Promise<CurriculumAssignmentImpact> {
  const res = await api.get<CurriculumAssignmentImpact>(`/org/classes/${classId}/curriculum/impact`, {
    params: versionId ? { versionId } : {},
  })
  return res.data
}

export async function assignCurriculum(
  classId: number,
  versionId: number,
): Promise<ClassCurriculumLink> {
  const res = await api.post<ClassCurriculumLink>(`/org/classes/${classId}/curriculum`, { versionId })
  return res.data
}

export async function unassignCurriculum(classId: number): Promise<void> {
  await api.delete(`/org/classes/${classId}/curriculum`)
}
