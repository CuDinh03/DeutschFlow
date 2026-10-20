import { PERSONA_LIST } from '@/lib/personas'
import { workplaceInterviewer } from '@/lib/workplaceInterviewers'

/**
 * Tên + vai người phỏng vấn theo mã nhân vật backend (`OccupationDetail.personaCode`).
 * Nhân vật cũ: tên + tag trong `personas.ts`. Người tuyển dụng theo nơi làm việc: `roleKey` để đọc
 * vai từ catalog `v2.landing.interviewerRoles`. Mã khác (DEFAULT) → null: không hiện người phỏng vấn.
 */
export type InterviewerInfo =
  | { kind: 'persona'; name: string; tag: string }
  | { kind: 'workplace'; name: string; roleKey: string }

export function interviewerInfo(personaCode: string | null | undefined): InterviewerInfo | null {
  if (!personaCode) return null
  const legacy = PERSONA_LIST.find((p) => p.id === personaCode.toLowerCase())
  if (legacy) return { kind: 'persona', name: legacy.name, tag: legacy.tag }
  const w = workplaceInterviewer(personaCode)
  if (w) return { kind: 'workplace', name: w.name, roleKey: w.code }
  return null
}
