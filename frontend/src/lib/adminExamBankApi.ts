import api from '@/lib/api'

/** API Đ5b-A Admin ngân hàng đề — `/admin/speaking/exam/bank/**` (ADMIN). */

export interface BankPoolCell {
  provider: string
  level: string
  teilNo: number
  archetype: string
  title: string
  cardsNeeded: number
  poolApproved: number
}

export interface BankTaskRow {
  id: number
  /** null = đề dùng chung mọi hệ. */
  provider: string | null
  level: string
  teilNo: number
  archetype: string
  status: 'DRAFT' | 'APPROVED' | 'RETIRED'
  source: string
  stimulus: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface BankTaskPayload {
  provider: string | null
  level: string
  teilNo: number
  archetype: string
  status: string | null
  stimulus: Record<string, unknown>
}

export interface BankBlueprintPart {
  teilNo: number
  archetype: string
  title: string
  durationSec: number
  cardsNeeded: number
  hasPartner: boolean
}

export interface BankBlueprint {
  id: number
  provider: string
  level: string
  title: string
  prepSec: number
  parts: BankBlueprintPart[]
}

export interface BankTaskFilters {
  provider?: string
  level?: string
  teilNo?: number
  status?: string
}

export const adminExamBankApi = {
  overview: () => api.get<BankPoolCell[]>('/admin/speaking/exam/bank/overview'),
  tasks: (params: BankTaskFilters) => api.get<BankTaskRow[]>('/admin/speaking/exam/bank/tasks', { params }),
  create: (payload: BankTaskPayload) => api.post<BankTaskRow>('/admin/speaking/exam/bank/tasks', payload),
  update: (id: number, payload: BankTaskPayload) => api.put<BankTaskRow>(`/admin/speaking/exam/bank/tasks/${id}`, payload),
  blueprints: () => api.get<BankBlueprint[]>('/admin/speaking/exam/bank/blueprints'),
}
