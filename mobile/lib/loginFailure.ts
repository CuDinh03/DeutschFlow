import { isAxiosErr } from '@/lib/api'

/**
 * Phân loại lỗi đăng nhập — dùng cho CẢ thông báo trên màn hình lẫn thuộc tính `reason` của sự kiện
 * `login_failed`.
 *
 * Trước 11/2026 `reason` là chuỗi thô của axios ("Request failed with status code 400",
 * "timeout of 15000ms exceeded"): không tách được "sai email/mật khẩu" khỏi "máy chủ chậm", và người
 * mới cài app chưa có tài khoản chỉ thấy một câu "Email hoặc mật khẩu không đúng" rồi bỏ.
 */
export type LoginFailureKind =
  | 'wrong_role'
  | 'credentials'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'server'
  | 'unknown'

export function loginFailureKind(e: unknown): LoginFailureKind {
  if (e instanceof Error && e.message === 'NON_STUDENT_ROLE') return 'wrong_role'
  if (!isAxiosErr(e)) return 'unknown'
  const status = e.response?.status
  if (status == null) {
    const timedOut = e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || /timeout/i.test(e.message ?? '')
    return timedOut ? 'timeout' : 'network'
  }
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  // Backend trả 400 cho cả "email chưa có tài khoản" lẫn "sai mật khẩu" (cố ý không phân biệt);
  // 401/403/404 từ proxy cũ cũng xếp chung — với người dùng đều là "thông tin đăng nhập không khớp".
  if (status >= 400) return 'credentials'
  return 'unknown'
}
