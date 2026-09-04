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
export const PASSWORD_MIN_LENGTH = 6

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
