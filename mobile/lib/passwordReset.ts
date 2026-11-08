/**
 * Logic thuần của màn đặt lại mật khẩu (`app/(auth)/reset-password.tsx`) — tách ra để jest kiểm được.
 *
 * Hợp đồng backend (#772 chống dò email, #788 khoá mã sau N lần sai):
 *   POST /auth/forgot-password → 204 luôn luôn (cả email lạ) · 429
 *   POST /auth/reset-password  → 204 · 400 extensions.code = RESET_CODE_INVALID cho MỌI kiểu mã hỏng (sai, đã
 *                                dùng, hết hạn, bị huỷ vì sai quá nhiều, tài khoản không còn) · 429
 * App hiện MỘT câu trung tính theo ngôn ngữ app cho mọi kiểu mã hỏng (trước đây hiện nguyên `detail` tiếng
 * Việt của server), kèm lối gửi mã mới — mã đã bị huỷ thì nhập lại cũng vô ích.
 */

export const RESET_CODE_INVALID = 'RESET_CODE_INVALID'

type ErrLike = {
  isAxiosError?: boolean
  response?: {
    status?: number
    data?: { extensions?: { code?: unknown } }
  }
}

export type ResetFailure = 'reset.wrongCode' | 'reset.tooMany' | 'reset.network' | null

/** Lỗi /reset-password ⇒ khoá câu hiển thị; `null` = lỗi khác (vd. mật khẩu yếu) — để `apiMessage` lo. */
export function resetFailure(e: unknown): ResetFailure {
  const resp = (e as ErrLike)?.response
  // Chỉ lỗi HTTP không có phản hồi mới là mất mạng; lỗi JS khác để apiMessage nói.
  if (!resp) return (e as ErrLike)?.isAxiosError ? 'reset.network' : null
  if (resp.status === 429) return 'reset.tooMany'
  if (resp.data?.extensions?.code === RESET_CODE_INVALID) return 'reset.wrongCode'
  return null
}
