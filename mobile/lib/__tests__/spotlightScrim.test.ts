import { scrimZones } from '../spotlightScrim'

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
