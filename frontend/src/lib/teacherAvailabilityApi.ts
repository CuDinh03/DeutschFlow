import api from '@/lib/api'

/** One weekly-recurring availability block. day: 0 = Monday … 6 = Sunday; start/end: "HH:mm" (24h). */
export interface AvailabilitySlot {
  day: number
  start: string
  end: string
}

/** GET /api/v2/teacher/availability — the current teacher's weekly recurring slots. */
export async function getAvailability(): Promise<AvailabilitySlot[]> {
  const res = await api.get<{ slots: AvailabilitySlot[] }>('/v2/teacher/availability')
  return res.data?.slots ?? []
}

/** PUT /api/v2/teacher/availability — replace the weekly slots; returns the stored (normalized) value. */
export async function putAvailability(slots: AvailabilitySlot[]): Promise<AvailabilitySlot[]> {
  const res = await api.put<{ slots: AvailabilitySlot[] }>('/v2/teacher/availability', { slots })
  return res.data?.slots ?? []
}
