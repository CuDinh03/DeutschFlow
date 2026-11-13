/**
 * Gọi backend từ phía máy chủ Next (server component, route handler, sitemap) — 13/11/2026.
 *
 * Trước đây trang server gọi backend qua địa chỉ công khai `NEXT_PUBLIC_BACKEND_URL`
 * (`https://api.mydeutschflow.com`): request đi ra mạng nhà nơi đặt máy chủ → Cloudflare → tunnel → quay
 * lại chính máy chủ. Đo trong container frontend: 784 ms và thỉnh thoảng "fetch failed" (mạng nhà rơi
 * gói SYN tới dải IP Cloudflare của tên miền) → trang nghề 500. Gọi thẳng qua mạng Docker nội bộ: 92 ms.
 *
 * `BACKEND_INTERNAL_URL` (biến lúc CHẠY, chỉ đặt trên máy chủ — `deploy-frontend-vm.sh`) trỏ tới tên
 * nội bộ cố định của backend (`http://deutschflow-api:8080`, alias mạng do `deploy-backend-vm.sh` gắn cho
 * cả màu blue lẫn green). Không có biến (máy dev, CI) → dùng địa chỉ công khai như cũ. Lỗi MẠNG khi gọi
 * nội bộ (alias chưa có, backend đang đổi màu…) → thử lại một lần qua địa chỉ công khai; mã HTTP lỗi
 * (404, 429, 5xx) trả về nguyên vẹn, không thử lại, để hợp đồng của nơi gọi giữ nguyên.
 *
 * KHÔNG dùng ở code chạy trên trình duyệt: trình duyệt không thấy mạng nội bộ.
 */

function trimOrigin(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/api$/, '')
}

/** Địa chỉ backend công khai (trình duyệt và đường dự phòng của máy chủ). */
export function publicBackendOrigin(): string {
  return trimOrigin(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
}

/** Địa chỉ nội bộ nếu máy chủ có đặt `BACKEND_INTERNAL_URL`, không thì `null`. */
export function internalBackendOrigin(): string | null {
  const v = process.env.BACKEND_INTERNAL_URL?.trim()
  return v ? trimOrigin(v) : null
}

/** Thời gian chờ tối đa cho lời gọi nội bộ trước khi lùi về địa chỉ công khai. */
const INTERNAL_TIMEOUT_MS = 5000

/**
 * `fetch` tới backend với `path` bắt đầu bằng `/api/...`. Ưu tiên mạng nội bộ, lỗi mạng thì lùi về
 * địa chỉ công khai. Giữ nguyên `init` (gồm `next: { revalidate }`).
 */
export async function serverBackendFetch(path: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<Response> {
  const internal = internalBackendOrigin()
  if (internal) {
    try {
      const signal = init?.signal ?? AbortSignal.timeout(INTERNAL_TIMEOUT_MS)
      return await fetch(`${internal}${path}`, { ...init, signal })
    } catch {
      // Lỗi mạng nội bộ → đi đường công khai bên dưới.
    }
  }
  return fetch(`${publicBackendOrigin()}${path}`, init)
}
