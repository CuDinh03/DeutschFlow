import { formatCountVi, formatSpokenTime, weekdayBars } from '@/lib/progressFormat'

describe('formatCountVi', () => {
  test.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1240, '1.240'],
    [1234567, '1.234.567'],
    [-1500, '-1.500'],
  ])('%p → %p', (n, out) => {
    expect(formatCountVi(n)).toBe(out)
  })

  test('null/NaN về 0, số lẻ bỏ phần thập phân', () => {
    expect(formatCountVi(null)).toBe('0')
    expect(formatCountVi(undefined)).toBe('0')
    expect(formatCountVi(Number.NaN)).toBe('0')
    expect(formatCountVi(1240.9)).toBe('1.240')
  })
})

describe('formatSpokenTime', () => {
  test('dưới một giờ ghi phút', () => {
    expect(formatSpokenTime(0)).toBe('0 phút')
    expect(formatSpokenTime(45)).toBe('45 phút')
    expect(formatSpokenTime(59)).toBe('59 phút')
  })

  test('từ một giờ ghi giờ, dấu phẩy thập phân', () => {
    expect(formatSpokenTime(60)).toBe('1 giờ')
    expect(formatSpokenTime(192)).toBe('3,2 giờ')
    expect(formatSpokenTime(180)).toBe('3 giờ')
  })

  test('thiếu hoặc âm coi là 0 phút', () => {
    expect(formatSpokenTime(null)).toBe('0 phút')
    expect(formatSpokenTime(-5)).toBe('0 phút')
  })
})

describe('weekdayBars', () => {
  // 19/11/2026 là Thứ Năm.
  const thursday = new Date(2026, 10, 19, 10, 0, 0)

  test('bảy cột T2…CN, tỉ lệ theo ngày nhiều nhất, đánh dấu hôm nay', () => {
    const bars = weekdayBars([25, 50, 0, 100, 0, 0, 0], thursday)
    expect(bars.map((b) => b.label)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
    expect(bars.map((b) => b.ratio)).toEqual([0.25, 0.5, 0, 1, 0, 0, 0])
    expect(bars.filter((b) => b.isToday).map((b) => b.label)).toEqual(['T5'])
  })

  test('Chủ nhật là cột cuối', () => {
    const sunday = new Date(2026, 10, 22, 9, 0, 0)
    expect(weekdayBars([], sunday).find((b) => b.isToday)?.label).toBe('CN')
  })

  test('mảng thiếu, null, số âm hay NaN đều về 0; tuần trống mọi tỉ lệ 0', () => {
    const bars = weekdayBars([Number.NaN, -3], thursday)
    expect(bars).toHaveLength(7)
    expect(bars.every((b) => b.minutes === 0 && b.ratio === 0)).toBe(true)
    expect(weekdayBars(null, thursday)).toHaveLength(7)
  })
})
