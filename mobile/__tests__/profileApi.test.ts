// Khoá hợp đồng đổi mật khẩu (N4, đợt 2 plan nâng cấp mobile 05/09).

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import api from '@/lib/api'
import { BIRTH_DATE_SELF_DECLARE_ENABLED, PASSWORD_MIN_LENGTH, profileApi, validatePasswordChange } from '@/lib/profileApi'

const patch = api.patch as unknown as jest.Mock
const get = api.get as unknown as jest.Mock
const post = api.post as unknown as jest.Mock
const del = api.delete as unknown as jest.Mock

beforeEach(() => {
  patch.mockReset()
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('profileApi.changePassword — đúng endpoint và body của ProfileController', () => {
  test('PATCH /profile/me/password với currentPassword + newPassword, trả void', async () => {
    patch.mockResolvedValue({ data: null })
    const out = await profileApi.changePassword({ currentPassword: 'cu123456', newPassword: 'moi123456' })
    expect(out).toBeUndefined()
    expect(patch).toHaveBeenCalledWith('/profile/me/password', {
      currentPassword: 'cu123456',
      newPassword: 'moi123456',
    })
  })

  test('lỗi server nổi lên nguyên vẹn để màn hình hiện apiMessage', async () => {
    patch.mockRejectedValue(new Error('Mật khẩu hiện tại không đúng.'))
    await expect(profileApi.changePassword({ currentPassword: 'x', newPassword: 'y123456' })).rejects.toThrow(
      'Mật khẩu hiện tại không đúng.',
    )
  })
})

describe('validatePasswordChange — khớp PasswordPolicy.MIN_LENGTH backend, không trim', () => {
  test('hợp lệ → không lỗi', () => {
    expect(validatePasswordChange('cu123456', 'moi123456', 'moi123456')).toEqual({})
    expect(PASSWORD_MIN_LENGTH).toBe(8) // khớp PasswordPolicy.MIN_LENGTH của backend
  })

  test('thiếu mật khẩu hiện tại', () => {
    expect(validatePasswordChange('', 'moi123456', 'moi123456')).toEqual({ current: 'Nhập mật khẩu hiện tại.' })
  })

  test('mật khẩu mới ngắn hơn sàn', () => {
    const e = validatePasswordChange('cu123456', 'ab12', 'ab12')
    // Bám HẰNG chứ không chép số: sàn mật khẩu đổi 6 → 8 ngày 09/09/2026 để khớp backend
    // (PasswordPolicy.MIN_LENGTH), và ca này từng là nơi duy nhất còn ghim số cũ.
    expect(e.next).toMatch(new RegExp(`ít nhất ${PASSWORD_MIN_LENGTH} ký tự`))
    expect(e.confirm).toBeUndefined()
  })

  test('mật khẩu mới trùng mật khẩu hiện tại', () => {
    expect(validatePasswordChange('cu123456', 'cu123456', 'cu123456').next).toBe('Mật khẩu mới phải khác mật khẩu hiện tại.')
  })

  test('nhập lại không khớp; khoảng trắng là ký tự hợp lệ, không bị trim', () => {
    expect(validatePasswordChange('cu123456', 'moi123456', 'moi12345').confirm).toBe('Mật khẩu nhập lại chưa khớp.')
    expect(validatePasswordChange('cu123456', 'moi 123456', 'moi 123456')).toEqual({})
    expect(validatePasswordChange('cu123456', 'moi 123456', 'moi123456').confirm).toBeDefined()
  })
})

// Đợt Hồ sơ cá nhân (14–17/09/2026): hợp đồng của ProfileController cho ảnh đại diện,
// thông tin cá nhân và ngày sinh — đúng endpoint, đúng body, lỗi server nổi lên nguyên vẹn.
describe('profileApi — hồ sơ cá nhân (GET /me, PATCH /me, avatar, ngày sinh)', () => {
  test('me() đọc GET /profile/me và trả nguyên PersonalProfile (có birthDateLocked)', async () => {
    const me = { userId: 7, email: 'a@b.c', displayName: 'A', phoneNumber: null, locale: 'vi',
      avatarUrl: null, role: 'STUDENT', birthDate: null, birthDateLocked: false, notificationTimezone: null }
    get.mockResolvedValue({ data: me })
    expect(await profileApi.me()).toEqual(me)
    expect(get).toHaveBeenCalledWith('/profile/me')
  })

  test('update() PATCH /profile/me chỉ với các trường được đưa vào', async () => {
    patch.mockResolvedValue({ data: { displayName: 'Bình' } })
    await profileApi.update({ displayName: 'Bình', phoneNumber: '0912345678' })
    expect(patch).toHaveBeenCalledWith('/profile/me', { displayName: 'Bình', phoneNumber: '0912345678' })
  })

  test('uploadAvatar() gói tệp kiểu RN {uri,type,name} vào FormData, multipart, timeout 30s, trả avatarUrl', async () => {
    // FormData của Node trong jest ép giá trị không phải Blob thành chuỗi "[object Object]", còn
    // FormData của RN giữ nguyên object {uri,type,name} — thay bằng bản giả chỉ ghi lại append()
    // để kiểm đúng thứ RN sẽ gửi.
    const appended: unknown[][] = []
    const RealFormData = globalThis.FormData
    class FakeFormData { append(k: string, v: unknown) { appended.push([k, v]) } }
    ;(globalThis as unknown as { FormData: unknown }).FormData = FakeFormData
    try {
      post.mockResolvedValue({ data: { avatarUrl: 'https://cdn/x.jpg' } })
      const url = await profileApi.uploadAvatar('file:///tmp/a.jpg', 'image/jpeg', 'a.jpg')
      expect(url).toBe('https://cdn/x.jpg')
      const [path, form, cfg] = post.mock.calls[0]
      expect(path).toBe('/profile/me/avatar')
      expect(form).toBeInstanceOf(FakeFormData)
      expect(appended).toEqual([['file', { uri: 'file:///tmp/a.jpg', type: 'image/jpeg', name: 'a.jpg' }]])
      expect(cfg).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 })
    } finally {
      ;(globalThis as unknown as { FormData: unknown }).FormData = RealFormData
    }
  })

  test('removeAvatar() gọi DELETE /profile/me/avatar', async () => {
    del.mockResolvedValue({ data: null })
    await profileApi.removeAvatar()
    expect(del).toHaveBeenCalledWith('/profile/me/avatar')
  })

  test('declareBirthDate() PATCH /profile/me/birth-date và trả trạng thái vị thành niên', async () => {
    patch.mockResolvedValue({ data: { birthDate: '2010-05-01', minorStatus: 'MINOR_LEGAL', requiresGuardianConsent: true } })
    const out = await profileApi.declareBirthDate('2010-05-01')
    expect(patch).toHaveBeenCalledWith('/profile/me/birth-date', { birthDate: '2010-05-01' })
    expect(out.requiresGuardianConsent).toBe(true)
  })

  test('lỗi 409 khai lần hai nổi lên nguyên vẹn (màn hình hiện messageOf)', async () => {
    patch.mockRejectedValue(new Error('Tài khoản đã có ngày sinh nên không thể tự đổi.'))
    await expect(profileApi.declareBirthDate('1996-03-05')).rejects.toThrow('đã có ngày sinh')
  })

  test('cờ tự khai ngày sinh đang TẮT (chờ Q-04) — bật là phải chủ ý, cùng lúc với web', () => {
    expect(BIRTH_DATE_SELF_DECLARE_ENABLED).toBe(false)
  })
})
