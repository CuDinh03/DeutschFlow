import type { OccupationDetail, OccupationSummary } from '@/lib/occupationTypes'
import { isOccupationCode } from '@/lib/occupationTypes'

/**
 * Đọc danh mục nghề công khai từ trang server (`/phong-van`, sitemap). Giữ bản sao 10 phút — cùng
 * `max-age` backend trả — nên mỗi trang nghề không gọi backend theo từng lượt xem.
 *
 * Danh sách: lỗi mạng hay backend chưa có endpoint (frontend lên trước backend) → `null`: trang tổng
 * hiện trạng thái "chưa tải được" (noindex), sitemap bỏ qua trang nghề.
 *
 * Chi tiết: CHỈ backend trả 404 mới là "không có nghề này" → `null` → trang 404. Lỗi tạm (429, 5xx,
 * mạng) → ném `OccupationUnavailableError` → 500: bot coi là tạm và quay lại, thay vì gỡ trang. Nghiệm
 * thu prod 21/10/2026: frontend gọi backend từ một IP cho mọi khách, bot quét sitemap làm backend 429
 * và trước đây hàng loạt trang nghề thành 404.
 */
const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

const REVALIDATE_SECONDS = 600

/** Backend không trả được chi tiết nghề vì lỗi tạm — không được hiểu thành "không có nghề". */
export class OccupationUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OccupationUnavailableError'
  }
}

function request(path: string): Promise<Response> {
  return fetch(`${backendOrigin}/api/public/occupations${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
}

export async function fetchOccupations(): Promise<OccupationSummary[] | null> {
  try {
    const res = await request('')
    if (!res.ok) return null
    return (await res.json()) as OccupationSummary[]
  } catch {
    return null
  }
}

export async function fetchOccupationDetail(code: string): Promise<OccupationDetail | null> {
  if (!isOccupationCode(code)) return null
  let res: Response
  try {
    res = await request(`/${code}`)
  } catch (e) {
    throw new OccupationUnavailableError(`occupation ${code}: ${e instanceof Error ? e.message : 'network error'}`)
  }
  if (res.status === 404) return null
  if (!res.ok) throw new OccupationUnavailableError(`occupation ${code}: backend ${res.status}`)
  return (await res.json()) as OccupationDetail
}
