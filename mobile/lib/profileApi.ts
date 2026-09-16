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

export interface PersonalProfile {
  userId: number
  email: string
  displayName: string
  phoneNumber: string | null
  locale: string | null
  avatarUrl: string | null
  role: string
  /** ISO yyyy-MM-dd, null = chưa khai. */
  birthDate: string | null
  /** true = đã ghi ⇒ chỉ đọc; muốn sửa phải qua trung tâm hoặc hỗ trợ. */
  birthDateLocked: boolean
  notificationTimezone: string | null
}

export const profileApi = {
  changePassword: (payload: ChangePasswordPayload) =>
    api.patch<void>('/profile/me/password', payload).then(() => undefined),

  me: async (): Promise<PersonalProfile> => (await api.get<PersonalProfile>('/profile/me')).data,

  update: async (patch: { displayName?: string; phoneNumber?: string }) =>
    (await api.patch('/profile/me', patch)).data,

  /**
   * Tải ảnh đại diện lên. Ảnh đã được ImagePicker cắt vuông sẵn (allowsEditing + aspect 1:1) nên
   * không cần xử lý thêm ở đây.
   *
   * 🪤 RN đòi object {uri,type,name} chứ không phải Blob — ép kiểu như mọi multipart khác trong app
   * (xem speakingApi.transcribe).
   */
  uploadAvatar: async (uri: string, mimeType: string, fileName: string): Promise<string> => {
    const form = new FormData()
    form.append('file', { uri, type: mimeType, name: fileName } as unknown as Blob)
    const r = await api.post<{ avatarUrl: string }>('/profile/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    })
    return r.data.avatarUrl
  },

  removeAvatar: async (): Promise<void> => {
    await api.delete('/profile/me/avatar')
  },

  /** Ghi ngày sinh (ISO yyyy-MM-dd). Backend chỉ cho ghi MỘT LẦN, lần sau trả 409. */
  declareBirthDate: async (birthDate: string) =>
    (await api.patch<{ birthDate: string; minorStatus: string; requiresGuardianConsent: boolean }>(
      '/profile/me/birth-date',
      { birthDate }
    )).data,
}

/**
 * Ghép ngày/tháng/năm rời thành chuỗi ISO, hoặc trả lỗi người đọc được.
 *
 * <p>Ba ô số thay vì một bộ chọn lịch là quyết định có chủ đích: mọi thư viện date picker của RN
 * đều là NATIVE MODULE, thêm vào là phải build lại app và không thể phát hành bằng OTA nữa. Ngày
 * sinh không đáng để đánh đổi cả đường phát hành.
 */
export function toIsoBirthDate(
  day: string,
  month: string,
  year: string
): { iso: string } | { error: string } {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!day || !month || !year) return { error: 'Hãy nhập đủ ngày, tháng và năm.' }
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: 'Ngày sinh chỉ gồm chữ số.' }
  }
  if (m < 1 || m > 12) return { error: 'Tháng phải từ 1 đến 12.' }
  const thisYear = new Date().getFullYear()
  if (y < thisYear - 120 || y > thisYear) return { error: 'Năm sinh không hợp lệ.' }
  // new Date(y, m-1, d) tự "tràn" sang tháng sau với ngày 31/2 — so lại để bắt đúng lỗi đó thay vì
  // lặng lẽ gửi lên 03/03.
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { error: 'Ngày này không có trong tháng đã chọn.' }
  }
  if (probe.getTime() > Date.now()) return { error: 'Ngày sinh không thể ở tương lai.' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { iso: `${y}-${pad(m)}-${pad(d)}` }
}
