// Hồ sơ — phần API mobile chưa có tới 05/09 (N4, đợt 2 plan nâng cấp mobile):
// đổi mật khẩu trong app. Backend `PATCH /api/profile/me/password`
// (ProfileController → AuthService.changePassword): cần mật khẩu hiện tại, mật khẩu
// mới ≥ 6 ký tự; đổi xong server THU HỒI mọi refresh token + gỡ push token → app
// phải đăng xuất và đưa người dùng về màn đăng nhập (web làm y vậy: "Sau khi đổi
// buộc đăng nhập lại").
import api from './api'

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

/** Khớp @Size(min = 6) của ChangePasswordRequest phía backend. */
/**
 * Phải khớp `PasswordPolicy.MIN_LENGTH` của backend
 * (`backend/src/main/java/com/deutschflow/common/security/PasswordPolicy.java`).
 *
 * 🔴 Trước 09/09/2026 hằng này là 6 trong khi CHÍNH APP NÀY đã đòi 8 ở màn đăng ký
 * (`app/(auth)/register.tsx:60`) và màn đặt lại mật khẩu (`app/(auth)/reset-password.tsx:28`) —
 * một sự bất nhất nội bộ, và là cửa duy nhất còn cho đặt mật khẩu 6 ký tự.
 *
 * ⚠️ Bản đang phát hành trên App Store vẫn mang số 6. Backend nay đòi 8, nên tới khi bản này lên
 * OTA thì người dùng gõ 6–7 ký tự sẽ qua được kiểm tại máy rồi mới nhận lỗi từ máy chủ. Không hỏng,
 * nhưng thông điệp kém rõ vì `ChangePasswordRequest` dùng `@Size` nên lỗi đi qua nhánh
 * MethodArgumentNotValidException của GlobalExceptionHandler (detail là câu tiếng Anh chung).
 */
export const PASSWORD_MIN_LENGTH = 8

export interface PasswordChangeErrors {
  current?: string
  next?: string
  confirm?: string
}

/**
 * Kiểm tra phía client trước khi gọi server — thuần để test. Trả object rỗng khi
 * hợp lệ. Không trim mật khẩu (khoảng trắng là ký tự hợp lệ của mật khẩu).
 */
export function validatePasswordChange(current: string, next: string, confirm: string): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {}
  if (current.length === 0) errors.current = 'Nhập mật khẩu hiện tại.'
  if (next.length < PASSWORD_MIN_LENGTH) {
    errors.next = `Mật khẩu mới phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`
  } else if (current.length > 0 && next === current) {
    errors.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  }
  if (confirm !== next) errors.confirm = 'Mật khẩu nhập lại chưa khớp.'
  return errors
}

export const profileApi = {
  changePassword: (payload: ChangePasswordPayload) =>
    api.patch<void>('/profile/me/password', payload).then(() => undefined),
}
