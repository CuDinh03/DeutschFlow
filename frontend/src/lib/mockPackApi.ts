import api from '@/lib/api'

/** A mock-exam pack in the catalog (D3). `locked` = needs a paid plan the user lacks. */
export interface MockExamPack {
  id: number
  title: string
  descriptionVi: string | null
  cefrLevel: string
  examFormat: string
  examCount: number
  requiresPaid: boolean
  locked: boolean
}

export interface PackExam {
  id: number
  title: string
  totalPoints: number | null
  passPoints: number | null
  timeLimitMinutes: number | null
}

export interface MockExamPackDetail {
  id: number
  title: string
  descriptionVi: string | null
  cefrLevel: string
  examFormat: string
  exams: PackExam[]
}

/** GET /api/mock-exams/packs — the pack catalog (each flagged locked/unlocked for this user). */
export async function getMockPacks(): Promise<MockExamPack[]> {
  const res = await api.get<MockExamPack[]>('/mock-exams/packs')
  return res.data ?? []
}

/** GET /api/mock-exams/packs/{id} — a pack's exams (403 if the user can't access it). */
export async function getMockPack(id: number): Promise<MockExamPackDetail> {
  const res = await api.get<MockExamPackDetail>(`/mock-exams/packs/${id}`)
  return res.data
}
