import api from '@/lib/api'

// Danh mục nghề công khai (đợt 2a–2e A+B+E) — cùng hợp đồng với web `src/lib/occupationTypes.ts`.
// Hàm thuần ở đây (tìm nghề, suy industry, danh sách tháng) được khoá bằng test.

export interface OccupationSummary {
  code: string
  nameDe: string
  nameEn: string
  nameVi: string
  workplace: string
  aliases: string[]
  questionSet: 'CURATED' | 'GENERAL'
}

/** `GET /api/public/occupations` — không cần token, backend trả Cache-Control 10 phút. */
export async function fetchOccupations(): Promise<OccupationSummary[]> {
  const { data } = await api.get<OccupationSummary[]>('/public/occupations')
  return Array.isArray(data) ? data : []
}

/** Phần của `GET /api/public/occupations/{code}` mà app cần để mở phỏng vấn theo nghề (K3b). */
export interface OccupationInterviewInfo {
  occupation: OccupationSummary
  /** Mã SpeakingPersona sẽ phỏng vấn nghề này (nhân vật viết tay hoặc người tuyển dụng theo nơi làm việc). */
  personaCode: string
  interviewPosition: string
}

export async function fetchOccupationInterviewInfo(code: string): Promise<OccupationInterviewInfo> {
  const { data } = await api.get<OccupationInterviewInfo>(`/public/occupations/${encodeURIComponent(code)}`)
  return data
}

/** So khớp không phân biệt hoa thường, dấu tiếng Việt và umlaut tiếng Đức. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
}

/** Tìm theo tên Đức/Việt/Anh và tên gọi khác; giữ thứ tự danh mục (nghề phổ biến trước). */
export function searchOccupations(list: OccupationSummary[], query: string, limit: number): OccupationSummary[] {
  const q = foldText(query.trim())
  if (!q) return []
  return list
    .filter((o) => [o.nameDe, o.nameVi, o.nameEn, ...o.aliases].some((f) => foldText(f).includes(q)))
    .slice(0, limit)
}

/** Tên nghề theo ngôn ngữ giao diện (tiếng Đức hiện tên tiếng Đức). */
export function occupationName(o: Pick<OccupationSummary, 'nameDe' | 'nameEn' | 'nameVi'>, locale: string): string {
  if (locale === 'en') return o.nameEn
  if (locale === 'de') return o.nameDe
  return o.nameVi
}

// Cùng bảng với web `industryForOccupation`: backend chọn mentor theo `industry` (IndustryFamily so
// khớp từ khoá), nên quy nhóm nơi làm việc về đúng từ khoá họ ngành mentor đang hiểu.
const WORKPLACE_INDUSTRY: Record<string, string> = {
  gastro: 'Gastronomie', pflege: 'Pflege', bau: 'Technik', industrie: 'Technik',
  logistik: 'Technik', handel: 'Verkauf', buero: 'Büro', bildung: 'Bildung',
}
const IT_NAME = /entwickl|informatik|devops|software|daten|it-support|it-/i

export function industryForOccupation(o: { workplace: string; nameDe: string }): string | null {
  if (o.workplace === 'buero' && IT_NAME.test(o.nameDe)) return 'IT'
  return WORKPLACE_INDUSTRY[o.workplace] ?? null
}

/**
 * Các tháng chọn được cho ngày mốc: từ tháng hiện tại, `count` tháng. Giá trị gửi backend là ngày 01
 * của tháng (`yyyy-MM-01`) — backend bỏ qua ngày đã qua, nên không bao giờ đưa tháng cũ.
 */
export function targetMonths(now: Date, count: number): { value: string; year: number; month: number }[] {
  const out: { value: string; year: number; month: number }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const month = d.getMonth() + 1
    out.push({ value: `${d.getFullYear()}-${String(month).padStart(2, '0')}-01`, year: d.getFullYear(), month })
  }
  return out
}
