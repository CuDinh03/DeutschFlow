import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  baseScaleOf,
  centeredOffset,
  clampOffset,
  outputEdgeOf,
  sourceRectOf,
  zoomAroundCenter,
  type CropState,
} from './avatarCrop'

/** Ảnh ngang 1000×500, khung 300 — cạnh ngắn là chiều cao nên baseScale = 300/500. */
const landscape = (over: Partial<CropState> = {}): CropState => ({
  viewport: 300,
  naturalWidth: 1000,
  naturalHeight: 500,
  zoom: MIN_ZOOM,
  offsetX: 0,
  offsetY: 0,
  ...over,
})

describe('baseScaleOf', () => {
  it('lấy cạnh NGẮN để ảnh phủ kín khung vuông', () => {
    expect(baseScaleOf(300, 1000, 500)).toBe(0.6)
    expect(baseScaleOf(300, 500, 1000)).toBe(0.6)
  })

  it('không chia cho 0 khi ảnh chưa có kích thước', () => {
    expect(baseScaleOf(300, 0, 0)).toBe(1)
  })
})

describe('centeredOffset', () => {
  it('đặt ảnh vào giữa khung: phần thừa chia đều hai bên', () => {
    const { offsetX, offsetY } = centeredOffset({
      viewport: 300,
      naturalWidth: 1000,
      naturalHeight: 500,
      zoom: MIN_ZOOM,
    })
    // Ảnh sau khi nhân 0.6 rộng 600 → thừa 300 → lệch trái 150. Chiều cao vừa khít → 0.
    expect(offsetX).toBe(-150)
    expect(offsetY).toBe(0)
  })
})

describe('clampOffset', () => {
  it('không cho kéo lòi nền ra ở mép trái/trên', () => {
    const { offsetX, offsetY } = clampOffset(landscape({ offsetX: 80, offsetY: 40 }))
    expect(offsetX).toBe(0)
    expect(offsetY).toBe(0)
  })

  it('không cho kéo lòi nền ra ở mép phải/dưới', () => {
    // Ảnh rộng 600, khung 300 ⇒ offsetX nhỏ nhất là -300.
    const { offsetX } = clampOffset(landscape({ offsetX: -9999 }))
    expect(offsetX).toBe(-300)
  })
})

describe('zoomAroundCenter', () => {
  it('giữ nguyên điểm ảnh ở tâm khung khi phóng', () => {
    const start = { ...landscape(), ...centeredOffset(landscape()) }
    const zoomed = zoomAroundCenter(start, 2)
    const before = sourceRectOf(start)
    const after = sourceRectOf(zoomed)
    // Tâm vùng cắt (theo pixel gốc) không đổi; chỉ vùng cắt thu nhỏ lại.
    expect(before.sx + before.size / 2).toBeCloseTo(after.sx + after.size / 2, 5)
    expect(before.sy + before.size / 2).toBeCloseTo(after.sy + after.size / 2, 5)
    expect(after.size).toBeLessThan(before.size)
  })

  it('kẹp zoom trong biên cho phép', () => {
    expect(zoomAroundCenter(landscape(), 99).zoom).toBe(MAX_ZOOM)
    expect(zoomAroundCenter(landscape(), 0.1).zoom).toBe(MIN_ZOOM)
  })
})

describe('sourceRectOf', () => {
  it('ở zoom 1 lấy trọn cạnh ngắn của ảnh', () => {
    const state = { ...landscape(), ...centeredOffset(landscape()) }
    const { sx, sy, size } = sourceRectOf(state)
    expect(size).toBe(500) // trọn chiều cao
    expect(sx).toBe(250) // (1000-500)/2
    expect(sy).toBe(0)
  })

  it('luôn trả vùng vuông nằm trong ảnh, không âm', () => {
    const state = landscape({ offsetX: 9999, offsetY: 9999 })
    const { sx, sy, size } = sourceRectOf(state)
    expect(sx).toBeGreaterThanOrEqual(0)
    expect(sy).toBeGreaterThanOrEqual(0)
    expect(sx + size).toBeLessThanOrEqual(state.naturalWidth)
    expect(sy + size).toBeLessThanOrEqual(state.naturalHeight)
  })
})

describe('outputEdgeOf', () => {
  it('chặn trần 512 để ảnh 4000px không thành tệp nặng vô ích', () => {
    expect(outputEdgeOf(4000)).toBe(512)
  })

  it('KHÔNG phóng to ảnh nhỏ hơn trần — phóng chỉ làm nặng chứ không nét hơn', () => {
    expect(outputEdgeOf(120)).toBe(120)
  })
})
