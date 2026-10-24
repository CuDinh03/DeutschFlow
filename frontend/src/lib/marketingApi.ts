import api from '@/lib/api'

/**
 * Marketing / lead-magnet API client (public, no auth).
 *
 * Paths are relative to the axios `baseURL` (`<origin>/api`), so the `/api`
 * prefix is omitted. The free-grade endpoint lives under `/public/**`.
 */

export type ContactType = 'EMAIL' | 'ZALO' | 'PHONE'

/** POST /api/public/free-grade — request body. */
export interface FreeGradeInput {
  name?: string
  contact: string
  contactType?: ContactType
  topic?: string
  essay: string
  /** Honeypot — must stay empty for real users; bots that fill it are rejected. */
  website?: string
}

/** POST /api/public/free-grade — response. */
export interface FreeGradeResult {
  score: number
  feedback: string
  message: string
  /** Token for the public, shareable report at /report/{shareToken} (D6 PLG loop). */
  shareToken: string
}

/** GET /api/public/grade-report/{token} — public, no-PII shareable report. */
export interface GradeReport {
  topic: string | null
  score: number
  feedback: string
  createdAt: string
}

export type SchoolDemoStudentCount = 'LT20' | 'S20_50' | 'S50_200' | 'GT200'
export type SchoolDemoChannel = 'EMAIL' | 'ZALO' | 'WHATSAPP' | 'PHONE'

/** POST /api/public/school-demo-requests — form "Đặt lịch demo" của trang trung tâm (đợt 3a). */
export interface SchoolDemoInput {
  name: string
  organization: string
  country: string
  studentCount: SchoolDemoStudentCount
  contactChannel: SchoolDemoChannel
  contact: string
  message?: string
  /** Ngôn ngữ trang người gửi đang xem — owner trả lời đúng tiếng. */
  locale: 'vi' | 'en' | 'de'
  /** Honeypot — must stay empty for real users; bots that fill it are rejected. */
  website?: string
}

/** Gửi yêu cầu đặt lịch demo. 201 = đã nhận; 400 = dữ liệu sai; 429 = gửi quá nhiều. */
export async function submitSchoolDemoRequest(input: SchoolDemoInput): Promise<void> {
  await api.post('/public/school-demo-requests', input)
}

/** Submit an essay for a free AI grade and capture the lead. */
export async function submitFreeGrade(input: FreeGradeInput): Promise<FreeGradeResult> {
  const res = await api.post<FreeGradeResult>('/public/free-grade', input)
  return res.data
}
