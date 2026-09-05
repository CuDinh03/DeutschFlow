import { scrimZones, scrimZoneTransform, scrimCornerOffsets, scrimCornerRingOffset } from '../spotlightScrim'

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

// Miếng vá góc: 4 tấm chữ nhật để lại ô khoét VUÔNG góc trong khi khung vàng bo
// tròn (owner 05/09: "ô đó đang bo góc nhưng phần hiển thị sáng lại vuông").
// Mỗi góc = một ô r×r nằm TRONG ô khoét, chứa một vòng khuyên màu mờ (đường
// kính 4r, lỗ 2r) có tâm trùng góc trong → phần ngoài cung tròn bị phủ mờ,
// phần trong cung để sáng; ô r×r cắt (overflow hidden) phần vòng thừa.
describe('scrimCornerOffsets', () => {
  const cutout = { x: 40, y: 300, width: 320, height: 120 }
  const R = 8

  test('bốn miếng r×r nằm đúng bốn góc TRONG ô khoét, thứ tự TL · TR · BL · BR', () => {
    expect(scrimCornerOffsets(cutout, R)).toEqual([
      { x: 40, y: 300 },
      { x: 352, y: 300 },
      { x: 40, y: 412 },
      { x: 352, y: 412 },
    ])
  })

  test('mỗi miếng nằm trọn trong ô khoét, không lấn ra 4 tấm mờ (chồng = đậm gấp đôi)', () => {
    for (const c of scrimCornerOffsets(cutout, R)) {
      expect(c.x).toBeGreaterThanOrEqual(cutout.x)
      expect(c.x + R).toBeLessThanOrEqual(cutout.x + cutout.width)
      expect(c.y).toBeGreaterThanOrEqual(cutout.y)
      expect(c.y + R).toBeLessThanOrEqual(cutout.y + cutout.height)
    }
  })
})

describe('scrimCornerRingOffset', () => {
  const R = 8

  test('tâm vòng khuyên (cỡ 4r) trùng góc TRONG của ô khoét ở cả 4 miếng', () => {
    const centers = [0, 1, 2, 3].map((i) => {
      const o = scrimCornerRingOffset(i, R)
      return { x: o.left + 2 * R, y: o.top + 2 * R }
    })
    expect(centers).toEqual([
      { x: R, y: R }, // TL: góc trong là góc dưới-phải của miếng
      { x: 0, y: R }, // TR: dưới-trái
      { x: R, y: 0 }, // BL: trên-phải
      { x: 0, y: 0 }, // BR: trên-trái
    ])
  })

  test('trong miếng r×r: ngoài cung tròn bán kính r thì phủ mờ, trong cung thì sáng; không chỗ nào hở', () => {
    for (let i = 0; i < 4; i++) {
      const o = scrimCornerRingOffset(i, R)
      const cx = o.left + 2 * R
      const cy = o.top + 2 * R
      for (let px = 0.25; px < R; px += 0.5) {
        for (let py = 0.25; py < R; py += 0.5) {
          const d = Math.hypot(px - cx, py - cy)
          // Vòng khuyên vẽ vùng r < d ≤ 2r (lỗ bán kính r, biên ngoài 2r).
          const painted = d > R && d <= 2 * R
          expect(painted).toBe(d > R)
          // Góc xa nhất của miếng cách tâm r·√2 < 2r → vòng phủ kín, không hở.
          expect(d).toBeLessThanOrEqual(2 * R)
        }
      }
    }
  })
})
