import { describe, expect, test } from 'vitest'
import {
  CAMERA_IDLE,
  MAX_SCALE,
  MIN_SCALE,
  focusCamera,
  focusScaleFor,
  panBy,
  zoomAtPoint,
} from './camera'

/** Điểm nội dung p hiện ra ở đâu trong viewBox với camera này. */
const project = (cam: { scale: number; x: number; y: number }, px: number, py: number) => ({
  x: px * cam.scale + cam.x,
  y: py * cam.scale + cam.y,
})

describe('zoomAtPoint', () => {
  test('điểm neo đứng yên qua mọi nấc zoom', () => {
    let cam = CAMERA_IDLE
    const anchor = { x: 260, y: 300 }
    const before = project(cam, anchor.x, anchor.y)
    for (const factor of [1.25, 1.25, 1 / 1.1, 2]) {
      cam = zoomAtPoint(cam, factor, anchor.x, anchor.y)
      const after = project(cam, anchor.x, anchor.y)
      expect(after.x).toBeCloseTo(before.x, 6)
      expect(after.y).toBeCloseTo(before.y, 6)
    }
  })

  test('kẹp scale trong [MIN, MAX] và không trôi khi chạm trần', () => {
    const atMax = zoomAtPoint(CAMERA_IDLE, 100, 10, 10)
    expect(atMax.scale).toBe(MAX_SCALE)
    // Đã ở trần: zoom tiếp không đổi gì (ratio = 1 ⇒ x/y giữ nguyên).
    const again = zoomAtPoint(atMax, 2, 10, 10)
    expect(again).toEqual(atMax)

    expect(zoomAtPoint(CAMERA_IDLE, 0.001, 0, 0).scale).toBe(MIN_SCALE)
  })
})

describe('focusCamera', () => {
  test('đưa node về đúng tâm viewBox', () => {
    const cam = focusCamera(300, 800, 520, 1000, 1.8)
    const projected = project(cam, 300, 800)
    expect(projected.x).toBeCloseTo(260, 6)
    expect(projected.y).toBeCloseTo(500, 6)
    expect(cam.scale).toBe(1.8)
  })

  test('scale ngoài biên bị kẹp trước khi tính vị trí', () => {
    const cam = focusCamera(100, 100, 520, 700, 99)
    expect(cam.scale).toBe(MAX_SCALE)
    const projected = project(cam, 100, 100)
    expect(projected.x).toBeCloseTo(260, 6)
    expect(projected.y).toBeCloseTo(350, 6)
  })
})

describe('focusScaleFor', () => {
  // viewBox 520 rộng, node hit-radius 19 đơn vị — số thật của cây.
  test('cây dài (fit co nhỏ) cần scale bù lớn hơn cây ngắn', () => {
    const short = focusScaleFor(800, 420, 520, 700, 19, 20)
    const tall = focusScaleFor(800, 420, 520, 1400, 19, 20)
    expect(tall).toBeGreaterThan(short)
  })

  test('không thu nhỏ hơn 1 khi node đã đủ to ở mức fit', () => {
    expect(focusScaleFor(2000, 2000, 520, 700, 19, 20)).toBeGreaterThanOrEqual(1)
  })

  test('trần MAX_SCALE với cây cực dài, và khung rỗng trả 1 an toàn', () => {
    expect(focusScaleFor(400, 300, 520, 5000, 19, 20)).toBe(MAX_SCALE)
    expect(focusScaleFor(0, 0, 520, 700, 19, 20)).toBe(1)
  })
})

describe('panBy', () => {
  test('tịnh tiến thuần, không đổi scale, không mutate', () => {
    const cam = { scale: 1.5, x: 10, y: -4 }
    const moved = panBy(cam, 5, 7)
    expect(moved).toEqual({ scale: 1.5, x: 15, y: 3 })
    expect(cam).toEqual({ scale: 1.5, x: 10, y: -4 })
  })
})
