// Khoá hợp đồng đổi mật khẩu (N4, đợt 2 plan nâng cấp mobile 05/09).

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  apiMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import api from '@/lib/api'
import { PASSWORD_MIN_LENGTH, profileApi, validatePasswordChange } from '@/lib/profileApi'

const patch = api.patch as unknown as jest.Mock

beforeEach(() => patch.mockReset())

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

describe('validatePasswordChange — khớp @Size(min=6) backend, không trim', () => {
  test('hợp lệ → không lỗi', () => {
    expect(validatePasswordChange('cu123456', 'moi123456', 'moi123456')).toEqual({})
    expect(PASSWORD_MIN_LENGTH).toBe(6)
  })

  test('thiếu mật khẩu hiện tại', () => {
    expect(validatePasswordChange('', 'moi123456', 'moi123456')).toEqual({ current: 'Nhập mật khẩu hiện tại.' })
  })

  test('mật khẩu mới ngắn hơn 6', () => {
    const e = validatePasswordChange('cu123456', 'ab12', 'ab12')
    expect(e.next).toMatch(/ít nhất 6 ký tự/)
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
