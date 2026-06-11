import api from '@/lib/api'

/** A mock-exam pack as seen by an admin curator (D3) — raw curation fields + live exam count. */
export interface AdminMockPack {
  id: number
  title: string
  descriptionVi: string | null
  cefrLevel: string
  examFormat: string
  requiresPaid: boolean
  active: boolean
  sortOrder: number
  examCount: number
  createdAt: string
}

/** Create payload — title + cefrLevel required; the rest default server-side. */
export interface CreateMockPackBody {
  title: string
  descriptionVi?: string | null
  cefrLevel: string
  examFormat?: string
  requiresPaid?: boolean
  sortOrder?: number
}

/** Partial-update payload — only the provided fields are applied. */
export type UpdateMockPackBody = Partial<{
  title: string
  descriptionVi: string | null
  cefrLevel: string
  examFormat: string
  requiresPaid: boolean
  active: boolean
  sortOrder: number
}>

/** GET /api/admin/mock-exam-packs — all packs (active + inactive) in curation order. */
export async function listAdminMockPacks(): Promise<AdminMockPack[]> {
  const res = await api.get<AdminMockPack[]>('/admin/mock-exam-packs')
  return res.data ?? []
}

/** POST /api/admin/mock-exam-packs — create a pack. */
export async function createMockPack(body: CreateMockPackBody): Promise<AdminMockPack> {
  const res = await api.post<AdminMockPack>('/admin/mock-exam-packs', body)
  return res.data
}

/** PATCH /api/admin/mock-exam-packs/{id} — partial update (also used to re-publish: active=true). */
export async function updateMockPack(id: number, body: UpdateMockPackBody): Promise<AdminMockPack> {
  const res = await api.patch<AdminMockPack>(`/admin/mock-exam-packs/${id}`, body)
  return res.data
}

/** DELETE /api/admin/mock-exam-packs/{id} — soft-delete (retire from the student catalog). */
export async function deactivateMockPack(id: number): Promise<AdminMockPack> {
  const res = await api.delete<AdminMockPack>(`/admin/mock-exam-packs/${id}`)
  return res.data
}
