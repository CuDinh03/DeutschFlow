import api from '@/lib/api'

/** The teacher's plan status + today's expensive-AI allowance (D6²). */
export interface FreeTierStatus {
  freeTier: boolean
  pptxDaily: number
  pptxUsedToday: number
  ocrDaily: number
  ocrUsedToday: number
}

/** GET /api/v2/teacher/free-tier-status */
export async function getFreeTierStatus(): Promise<FreeTierStatus> {
  const res = await api.get<FreeTierStatus>('/v2/teacher/free-tier-status')
  return res.data
}
