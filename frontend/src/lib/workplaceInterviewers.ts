import type { Workplace } from '@/lib/occupationTypes'

/**
 * Người tuyển dụng theo nơi làm việc (đợt 2c A+B+E) — khớp hằng `SpeakingPersona` HOFFMANN…RICHTER
 * ở backend. Họ phỏng vấn mọi nghề dùng bộ câu hỏi chung trong nhóm; nghề có bộ viết tay vẫn do
 * nhân vật cũ trong `personas.ts` phỏng vấn.
 *
 * Cố ý KHÔNG nằm trong `PERSONA_TOKENS`: danh sách đó là màn chọn bạn đồng hành trong app, còn những
 * người này chỉ đến qua mã nghề (backend cũng lọc họ khỏi `/interviews/personas`).
 */
export interface WorkplaceInterviewer {
  code: string
  name: string
  workplace: Workplace
  /** Màu nền chân dung (hex, như `accent` trong personas.ts). */
  accent: string
  /** Chức danh tiếng Đức (khớp `role_title` của V336) — dòng vai trò trong phiên nói. */
  role: string
}

export const WORKPLACE_INTERVIEWERS: readonly WorkplaceInterviewer[] = [
  { code: 'HOFFMANN', name: 'Frau Hoffmann', workplace: 'gastro', accent: '#C2410C', role: 'Restaurantleiterin' },
  { code: 'KRUEGER', name: 'Frau Krüger', workplace: 'pflege', accent: '#0D9488', role: 'Pflegedienstleitung' },
  { code: 'BRANDT', name: 'Herr Brandt', workplace: 'bau', accent: '#EA580C', role: 'Bauleiter' },
  { code: 'WAGNER', name: 'Herr Wagner', workplace: 'industrie', accent: '#1E3A8A', role: 'Produktionsleiter' },
  { code: 'YILMAZ', name: 'Herr Yılmaz', workplace: 'logistik', accent: '#065F46', role: 'Lagerleiter' },
  { code: 'SCHULZ', name: 'Frau Schulz', workplace: 'handel', accent: '#BE185D', role: 'Filialleiterin' },
  { code: 'BECKER', name: 'Frau Becker', workplace: 'buero', accent: '#334155', role: 'Personalreferentin (HR)' },
  { code: 'RICHTER', name: 'Herr Richter', workplace: 'bildung', accent: '#4D7C0F', role: 'Kita-/Schulleitung' },
]

export function workplaceInterviewer(code: string | null | undefined): WorkplaceInterviewer | undefined {
  if (!code) return undefined
  const upper = code.toUpperCase()
  return WORKPLACE_INTERVIEWERS.find((w) => w.code === upper)
}
