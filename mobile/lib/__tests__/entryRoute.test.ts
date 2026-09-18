/**
 * M0 (Đợt 3, 17/09/2026): mở app chưa đăng nhập ⇒ màn Chào mừng, KHÔNG phải màn Đăng nhập.
 * Khoá bằng test để lần sau ai muốn đổi cửa vào phải sửa test — không thể vô tình (bài học F-1).
 */
import { entryHrefFor } from '@/lib/entryRoute'

describe('entryHrefFor', () => {
  it('chưa đăng nhập → Chào mừng (WELCOME), không còn đi thẳng Đăng nhập', () => {
    expect(entryHrefFor({ isLoggedIn: false })).toBe('/(auth)/welcome')
  })

  it('đã đăng nhập → Trang chủ', () => {
    expect(entryHrefFor({ isLoggedIn: true })).toBe('/(student)')
  })
})
