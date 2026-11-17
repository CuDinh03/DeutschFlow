import { MIN_TOUCH_PT, iconHitSlop } from '@/lib/touchTarget'

describe('iconHitSlop', () => {
  test.each([16, 20, 22, 24, 26, 28])('icon %ipt cộng hai phía đạt tối thiểu 44pt', (size) => {
    expect(size + 2 * iconHitSlop(size)).toBeGreaterThanOrEqual(MIN_TOUCH_PT)
  })

  test('icon 22pt mặc định: 11 mỗi phía (trước đây 8, chỉ được 38pt)', () => {
    expect(iconHitSlop(22)).toBe(11)
  })

  test('icon lớn vẫn giữ tối thiểu 8 để dễ bấm', () => {
    expect(iconHitSlop(40)).toBe(8)
    expect(iconHitSlop(60)).toBe(8)
  })
})
