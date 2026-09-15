import { scrimZones, spotlightHolePath } from '../spotlightHole'

const WIN = { w: 402, h: 874 }

describe('scrimZones', () => {
  test('bốn vùng bao kín màn hình quanh ô khoét, không chồng nhau', () => {
    const cutout = { x: 40, y: 300, width: 320, height: 120 }
    const [top, bottom, left, right] = scrimZones(cutout, WIN.w, WIN.h)

    expect(top).toEqual({ left: 0, top: 0, width: 402, height: 300 })
    expect(bottom).toEqual({ left: 0, top: 420, width: 402, height: 454 })
    expect(left).toEqual({ left: 0, top: 300, width: 40, height: 120 })
    expect(right).toEqual({ left: 360, top: 300, width: 42, height: 120 })

    // Tổng diện tích 4 vùng + ô khoét = cả màn (không hở, không chồng).
    const area = [top, bottom, left, right].reduce((s, z) => s + z.width * z.height, 0)
    expect(area + cutout.width * cutout.height).toBe(WIN.w * WIN.h)
  })

  test('ô khoét tràn mép trên/trái → vùng đó co về 0, không âm', () => {
    const [top, , left] = scrimZones({ x: -12, y: -20, width: 100, height: 60 }, WIN.w, WIN.h)
    expect(top.height).toBe(0)
    expect(left.width).toBe(0)
  })

  test('ô khoét tràn mép dưới/phải → vùng đó co về 0, không âm', () => {
    const [, bottom, , right] = scrimZones({ x: 350, y: 850, width: 100, height: 60 }, WIN.w, WIN.h)
    expect(bottom.height).toBe(0)
    expect(right.width).toBe(0)
  })

  test('ô khoét chiếm trọn màn → cả bốn vùng rỗng', () => {
    const zones = scrimZones({ x: 0, y: 0, width: WIN.w, height: WIN.h }, WIN.w, WIN.h)
    for (const z of zones) expect(z.width * z.height).toBe(0)
  })
})

// Lớp mờ = một path even-odd: tấm phủ cả màn + subpath ô khoét bo tròn. Máy
// thật của owner (06/09/2026) không vẽ 4 miếng vá góc kiểu View, nên góc bo
// phải nằm ngay trong hình khoét.
describe('spotlightHolePath', () => {
  const R = 8

  test('mở đầu bằng tấm phủ cả màn, rồi tới ô khoét bắt đầu ở (x+r, y) với 4 cung tròn', () => {
    const d = spotlightHolePath(WIN.w, WIN.h, { x: 40, y: 300, width: 320, height: 120 }, R)
    expect(d.startsWith('M0 0H402V874H0Z')).toBe(true)
    const hole = d.slice('M0 0H402V874H0Z'.length)
    expect(hole.startsWith('M48 300H352')).toBe(true)
    expect(hole.match(/A8 8 0 0 1 /g)).toHaveLength(4)
    expect(hole.endsWith('Z')).toBe(true)
    // Bốn điểm cung đi đúng vòng quanh ô: (360,308) → (360,412) → (352,420) → (48,420) → (40,412) → (40,308) → (48,300)
    expect(hole).toContain('A8 8 0 0 1 360 308V412A8 8 0 0 1 352 420H48A8 8 0 0 1 40 412V308A8 8 0 0 1 48 300Z')
  })

  test('bán kính kẹp về nửa cạnh ngắn khi ô khoét nhỏ hơn 2r', () => {
    const d = spotlightHolePath(WIN.w, WIN.h, { x: 10, y: 10, width: 10, height: 30 }, R)
    expect(d).toContain('A5 5 0 0 1 ')
    expect(d).not.toContain('A8 8')
  })

  test('ô khoét rỗng hoặc âm → chỉ còn tấm mờ phẳng (không subpath lỗ)', () => {
    expect(spotlightHolePath(WIN.w, WIN.h, { x: 0, y: 0, width: 0, height: 0 }, R)).toBe('M0 0H402V874H0Z')
    expect(spotlightHolePath(WIN.w, WIN.h, { x: 0, y: 0, width: 50, height: -1 }, R)).toBe('M0 0H402V874H0Z')
  })

  test('toạ độ lẻ được làm tròn 2 chữ số thập phân — chuỗi ngắn, không rác float', () => {
    const d = spotlightHolePath(393.33333, 852.1, { x: 12.345678, y: 20.1, width: 100.005, height: 40 }, R)
    expect(d).toContain('H393.33V852.1H0Z')
    expect(d).toContain('M20.35 20.1H104.35')
    expect(d).not.toMatch(/\d\.\d{3,}/)
  })
})
