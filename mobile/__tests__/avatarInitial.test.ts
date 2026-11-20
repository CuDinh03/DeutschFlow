// Chữ cái trên nút ảnh đại diện (lối vào "Tôi và cài đặt", owner chốt 18/11/2026).
import { avatarInitial } from '@/lib/avatarInitial'

describe('avatarInitial', () => {
  test('tên Việt lấy chữ đầu của tên gọi (từ cuối)', () => {
    expect(avatarInitial('Nguyễn Thị Lan')).toBe('L')
  })

  test('giữ dấu và viết hoa chữ có dấu', () => {
    expect(avatarInitial('trần văn ước')).toBe('Ư')
  })

  test('thừa khoảng trắng vẫn đúng', () => {
    expect(avatarInitial('  Minh   Tuấn  ')).toBe('T')
  })

  test('không có tên thì trả dấu hỏi', () => {
    expect(avatarInitial('')).toBe('?')
    expect(avatarInitial(undefined)).toBe('?')
    expect(avatarInitial(null)).toBe('?')
  })
})
