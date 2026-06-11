import api from '@/lib/api'

/** GET /api/admin/marketing/stats — growth funnel (lead magnet C8 + shared reports D6). */
export interface GrowthStats {
  leadsTotal: number
  leads7d: number
  leadsToday: number
  reportsTotal: number
  reports7d: number
  avgScore: number
  emailLeads: number
  zaloLeads: number
}

/** A captured lead (no IP). */
export interface MarketingLead {
  id: number
  name: string | null
  contact: string
  contactType: 'EMAIL' | 'ZALO' | 'PHONE'
  source: string
  topic: string | null
  essayChars: number
  score: number | null
  createdAt: string
}

export async function getGrowthStats(): Promise<GrowthStats> {
  const res = await api.get<GrowthStats>('/admin/marketing/stats')
  return res.data
}

export async function listLeads(days = 30, limit = 200): Promise<MarketingLead[]> {
  const res = await api.get<MarketingLead[]>('/admin/marketing/leads', { params: { days, limit } })
  return res.data ?? []
}
