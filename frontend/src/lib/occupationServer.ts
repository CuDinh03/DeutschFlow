import type { OccupationDetail, OccupationSummary } from '@/lib/occupationTypes'
import { isOccupationCode } from '@/lib/occupationTypes'

/**
 * Đọc danh mục nghề công khai từ trang server (`/phong-van`, sitemap). Giữ bản sao 10 phút — cùng
 * `max-age` backend trả — nên mỗi trang nghề không gọi backend theo từng lượt xem.
 *
 * Lỗi mạng hay backend chưa có endpoint (frontend lên trước backend) → `null`: trang tổng hiện
 * trạng thái "chưa tải được", trang nghề trả 404, sitemap bỏ qua trang nghề.
 */
const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

const REVALIDATE_SECONDS = 600

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${backendOrigin}/api/public/occupations${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function fetchOccupations(): Promise<OccupationSummary[] | null> {
  return getJson<OccupationSummary[]>('')
}

export function fetchOccupationDetail(code: string): Promise<OccupationDetail | null> {
  if (!isOccupationCode(code)) return Promise.resolve(null)
  return getJson<OccupationDetail>(`/${code}`)
}
