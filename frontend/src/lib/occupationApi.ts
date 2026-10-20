import api from '@/lib/api'
import type { OccupationDetail, OccupationSummary } from '@/lib/occupationTypes'

/**
 * Danh mục nghề công khai cho component client (ô tìm nghề trang chủ). Đường dẫn tương đối với
 * `baseURL` (`<origin>/api`). Endpoint không cần token, có `Cache-Control: public, max-age=600`.
 * Trang server (`/phong-van`) dùng `occupationServer.ts` thay vì file này.
 */
export const occupationApi = {
  list: () => api.get<OccupationSummary[]>('/public/occupations').then((r) => r.data),
  detail: (code: string) =>
    api.get<OccupationDetail>(`/public/occupations/${encodeURIComponent(code)}`).then((r) => r.data),
}
