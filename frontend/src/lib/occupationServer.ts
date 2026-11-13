import { unstable_cache } from 'next/cache'
import type { IndexableOccupation, OccupationDetail, OccupationSummary } from '@/lib/occupationTypes'
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

/** Backend trả mã lỗi tạm (429, 5xx…) — ném ra để KHÔNG bị giữ trong cache. */
class BackendStatusError extends Error {
  constructor(readonly status: number) {
    super(`backend ${status}`)
  }
}

/** 200 → dữ liệu; 404 → "không có" (được giữ trong cache như dữ liệu). */
type Loaded = { status: 200; body: unknown } | { status: 404 }

async function load(path: string): Promise<Loaded> {
  const res = await request(path)
  if (res.ok) return { status: 200, body: await res.json() }
  if (res.status === 404) return { status: 404 }
  throw new BackendStatusError(res.status)
}

/**
 * Giữ 10 phút bằng data cache của Next (13/11/2026). Trang nghề và sitemap là `force-dynamic`, mà
 * `force-dynamic` bỏ qua `next.revalidate` của `fetch` — nên trước đây MỖI lượt xem gọi backend (qua
 * địa chỉ công khai, đi vòng Cloudflare 0,7–1,3 s/lần, thỉnh thoảng "fetch failed" → 500). `unstable_cache`
 * vẫn chạy trong route động. Chỉ 200/404 được giữ; lỗi mạng và 429/5xx ném ra nên lần sau gọi lại.
 */
const loadCached = unstable_cache(load, ['public-occupations-v1'], { revalidate: REVALIDATE_SECONDS })

export async function fetchOccupations(): Promise<OccupationSummary[] | null> {
  try {
    const r = await loadCached('')
    return r.status === 200 ? (r.body as OccupationSummary[]) : null
  } catch {
    return null
  }
}

/**
 * Trang nghề được lập chỉ mục + ngày sửa nội dung (sitemap). Cùng điều kiện `reviewed` của trang chi
 * tiết, tính một lần ở backend. Backend chưa có endpoint hoặc lỗi → `null`: sitemap lùi về bộ viết tay.
 */
export async function fetchIndexableOccupations(): Promise<IndexableOccupation[] | null> {
  try {
    const r = await loadCached('/indexable')
    return r.status === 200 && Array.isArray(r.body) ? (r.body as IndexableOccupation[]) : null
  } catch {
    return null
  }
}

export async function fetchOccupationDetail(code: string): Promise<OccupationDetail | null> {
  if (!isOccupationCode(code)) return null
  let r: Loaded
  try {
    r = await loadCached(`/${code}`)
  } catch (e) {
    throw new OccupationUnavailableError(`occupation ${code}: ${e instanceof Error ? e.message : 'network error'}`)
  }
  return r.status === 404 ? null : (r.body as OccupationDetail)
}
