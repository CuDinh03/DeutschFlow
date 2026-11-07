import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'

/**
 * Gửi một request còn sống sau khi trang đóng (`fetch keepalive`) — axios chết theo document, nên
 * lần lưu cuối lúc `pagehide` / tab ẩn / rời màn phải đi đường này. Không chờ, không báo lỗi:
 * lần mở sau làm tiếp từ bản đã lưu gần nhất.
 */
export function sendKeepalive(method: 'PUT' | 'PATCH' | 'POST', path: string, body: unknown): void {
  const token = getAccessToken()
  try {
    void fetch(`${api.defaults.baseURL ?? ''}${path}`, {
      method,
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined)
  } catch {
    /* trình duyệt chặn keepalive (thân quá 64 KB…) — bỏ qua */
  }
}
