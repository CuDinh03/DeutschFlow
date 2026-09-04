import { scrimZones, scrimZoneTransform } from '../spotlightScrim'

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

/** Suy ngược hình chữ nhật từ transform (tấm gốc winW×winH neo 0,0, scale quanh tâm). */
function rectOf(t: ReturnType<typeof scrimZoneTransform>, winW: number, winH: number) {
  const [{ translateX }, { translateY }, { scaleX }, { scaleY }] = t.transform as [
    { translateX: number }, { translateY: number }, { scaleX: number }, { scaleY: number },
  ]
  const w = winW * scaleX
  const h = winH * scaleY
  return { left: winW / 2 + translateX - w / 2, top: winH / 2 + translateY - h / 2, width: w, height: h }
}

describe('scrimZoneTransform', () => {
  test('transform đặt tấm đúng vùng — cả 4 vùng quanh một ô khoét', () => {
    const cutout = { x: 40, y: 300, width: 320, height: 120 }
    for (const z of scrimZones(cutout, WIN.w, WIN.h)) {
      const r = rectOf(scrimZoneTransform(z, WIN.w, WIN.h), WIN.w, WIN.h)
      expect(r.left).toBeCloseTo(z.left, 6)
      expect(r.top).toBeCloseTo(z.top, 6)
      expect(r.width).toBeCloseTo(z.width, 6)
      expect(r.height).toBeCloseTo(z.height, 6)
    }
  })

  test('vùng rỗng → scale 0, không âm', () => {
    const t = scrimZoneTransform({ left: 0, top: 0, width: 0, height: -5 }, WIN.w, WIN.h)
    expect(t.transform[2]).toEqual({ scaleX: 0 })
    expect(t.transform[3]).toEqual({ scaleY: 0 })
  })

  test('chỉ dùng transform, không có thuộc tính layout', () => {
    const t = scrimZoneTransform({ left: 10, top: 20, width: 30, height: 40 }, WIN.w, WIN.h)
    expect(Object.keys(t)).toEqual(['transform'])
  })
})
