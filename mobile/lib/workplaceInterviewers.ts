// Người tuyển dụng theo nơi làm việc (đợt 2c A+B+E, K3 mobile) — khớp hằng `SpeakingPersona`
// HOFFMANN…RICHTER ở backend (V336) và `frontend/src/lib/workplaceInterviewers.ts` + bộ màu trong
// `WorkplaceInterviewerCharacter.tsx` của web. Họ phỏng vấn mọi nghề dùng bộ câu hỏi chung trong nhóm.
//
// Cố ý KHÔNG nằm trong `PERSONA_TOKENS`: danh sách đó là màn chọn bạn đồng hành, còn những người này
// chỉ đến qua mã nghề của phiên (backend cũng lọc họ khỏi `/interviews/personas`). Trước K3, phiên có
// persona lạ rơi về `lukas` ⇒ người học thấy mặt Lukas dù backend đang đóng vai Frau Krüger.

import type { PersonaVariant } from '@/components/speaking/PersonaCharacter'
import { PERSONA_TOKENS, type PersonaId } from './personas'

export type WorkplaceInterviewerId =
  | 'hoffmann' | 'krueger' | 'brandt' | 'wagner'
  | 'yilmaz' | 'schulz' | 'becker' | 'richter'

/** Ai được vẽ trên sân khấu phiên nói: bạn đồng hành, hoặc người tuyển dụng theo nơi làm việc. */
export type StagePersonaId = PersonaId | WorkplaceInterviewerId

export interface WorkplaceInterviewer {
  id: WorkplaceInterviewerId
  name: string
  role: string
  /** Màu viền/nhấn (hex, như `accent` trong personas.ts). */
  accent: string
  variant: PersonaVariant
}

const F_LIP = '#B76E79'
const M_LIP = '#A0675A'

export const WORKPLACE_INTERVIEWERS: Record<WorkplaceInterviewerId, WorkplaceInterviewer> = {
  hoffmann: {
    id: 'hoffmann', name: 'Frau Hoffmann', role: 'Restaurantleiterin', accent: '#C2410C',
    variant: { skin: '#F2C9A0', skinShadow: '#D9A57A', hair: '#3F2A1E', outfit: '#1F2937', outfitAccent: '#F5F5F4', eyeColor: '#4B3621', eyebrow: '#3F2A1E', lip: '#B4535E', accessory: 'none', hairStyle: 'long', gender: 'female' },
  },
  krueger: {
    id: 'krueger', name: 'Frau Krüger', role: 'Pflegedienstleitung', accent: '#0D9488',
    variant: { skin: '#F5D0B5', skinShadow: '#DDB091', hair: '#B8A88A', outfit: '#F8FAFC', outfitAccent: '#0D9488', eyeColor: '#4A6A8A', eyebrow: '#8C7B5E', lip: F_LIP, accessory: 'none', hairStyle: 'long', gender: 'female' },
  },
  brandt: {
    id: 'brandt', name: 'Herr Brandt', role: 'Bauleiter', accent: '#EA580C',
    variant: { skin: '#E8B48C', skinShadow: '#C98F66', hair: '#5A4632', outfit: '#EA580C', outfitAccent: '#FACC15', eyeColor: '#4B3621', eyebrow: '#4A3826', lip: M_LIP, accessory: 'none', hairStyle: 'short', gender: 'male' },
  },
  wagner: {
    id: 'wagner', name: 'Herr Wagner', role: 'Produktionsleiter', accent: '#1E3A8A',
    variant: { skin: '#F1C7A5', skinShadow: '#D6A27C', hair: '#9CA3AF', outfit: '#1E3A8A', outfitAccent: '#93C5FD', eyeColor: '#3B5B7A', eyebrow: '#7C838C', lip: '#A86F62', accessory: 'none', hairStyle: 'side_part', gender: 'male' },
  },
  yilmaz: {
    id: 'yilmaz', name: 'Herr Yılmaz', role: 'Lagerleiter', accent: '#065F46',
    variant: { skin: '#D9A27A', skinShadow: '#B98058', hair: '#1C1917', outfit: '#065F46', outfitAccent: '#FDE047', eyeColor: '#3A2618', eyebrow: '#1C1917', lip: '#94584A', accessory: 'none', hairStyle: 'short', gender: 'male' },
  },
  schulz: {
    id: 'schulz', name: 'Frau Schulz', role: 'Filialleiterin', accent: '#BE185D',
    variant: { skin: '#F6D2B8', skinShadow: '#DEB094', hair: '#7C2D12', outfit: '#BE185D', outfitAccent: '#FBCFE8', eyeColor: '#4F6B3A', eyebrow: '#6B2A12', lip: '#C2415D', accessory: 'none', hairStyle: 'curly', gender: 'female' },
  },
  becker: {
    id: 'becker', name: 'Frau Becker', role: 'Personalreferentin (HR)', accent: '#334155',
    variant: { skin: '#F3CFAF', skinShadow: '#D9AC8A', hair: '#D6B370', outfit: '#334155', outfitAccent: '#E2E8F0', eyeColor: '#3B6E8F', eyebrow: '#A88A52', lip: '#B5606B', accessory: 'none', hairStyle: 'long', gender: 'female' },
  },
  richter: {
    id: 'richter', name: 'Herr Richter', role: 'Kita-/Schulleitung', accent: '#4D7C0F',
    variant: { skin: '#EDBE98', skinShadow: '#D29C73', hair: '#6B4F3C', outfit: '#4D7C0F', outfitAccent: '#ECFCCB', eyeColor: '#5C4033', eyebrow: '#5A4232', lip: '#A26A5C', accessory: 'none', hairStyle: 'side_part', gender: 'male' },
  },
}

export function isWorkplaceInterviewerId(id: string): id is WorkplaceInterviewerId {
  return id in WORKPLACE_INTERVIEWERS
}

/**
 * Mã persona backend của phiên (`"KRUEGER"`, `"LUKAS"`, `"DEFAULT"`, null…) → ai được vẽ.
 * Mã không biết (kể cả `DEFAULT` của bài giao) vẫn về `lukas` như trước.
 */
export function resolveStagePersona(code: string | null | undefined): StagePersonaId {
  const id = code?.toLowerCase()
  if (!id) return 'lukas'
  if (id in PERSONA_TOKENS) return id as PersonaId
  if (isWorkplaceInterviewerId(id)) return id
  return 'lukas'
}

/** Tên, vai trò, màu nhấn để hiển thị — dùng chung cho bạn đồng hành và người tuyển dụng. */
export function stagePersonaInfo(id: StagePersonaId): { name: string; role: string; accent: string } {
  if (isWorkplaceInterviewerId(id)) {
    const w = WORKPLACE_INTERVIEWERS[id]
    return { name: w.name, role: w.role, accent: w.accent }
  }
  const t = PERSONA_TOKENS[id]
  return { name: t.name, role: t.role, accent: t.accent }
}
