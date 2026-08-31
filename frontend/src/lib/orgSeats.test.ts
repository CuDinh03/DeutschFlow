import { describe, expect, test } from 'vitest'
import { seatMeta, seatMetaOf } from './orgSeats'

describe('seatMeta', () => {
  test('limit 0 = không giới hạn — không phải hết ghế', () => {
    // Arrange + Act
    const m = seatMeta(37, 0)
    // Assert: org không giới hạn KHÔNG được hiểu là 0 ghế trống / 100% sức chứa
    expect(m).toEqual({ unlimited: true, free: null, pct: null })
  })

  test('limit âm (dữ liệu hỏng) cũng coi là không giới hạn thay vì NaN/âm', () => {
    expect(seatMeta(5, -1)).toEqual({ unlimited: true, free: null, pct: null })
  })

  test('tính free và pct bình thường khi có giới hạn', () => {
    expect(seatMeta(30, 40)).toEqual({ unlimited: false, free: 10, pct: 75 })
  })

  test('dùng vượt giới hạn: free không âm, pct cắt trần 100', () => {
    expect(seatMeta(45, 40)).toEqual({ unlimited: false, free: 0, pct: 100 })
  })

  test('chưa dùng ghế nào', () => {
    expect(seatMeta(0, 40)).toEqual({ unlimited: false, free: 40, pct: 0 })
  })
})

describe('seatMetaOf', () => {
  test('summary null (chưa tải/lỗi) trả null — KHÔNG giả vờ "không giới hạn"', () => {
    expect(seatMetaOf(null)).toBeNull()
    expect(seatMetaOf(undefined)).toBeNull()
  })

  test('summary có thật thì ủy quyền cho seatMeta', () => {
    expect(seatMetaOf({ seatUsed: 30, seatLimit: 40 })).toEqual({ unlimited: false, free: 10, pct: 75 })
    expect(seatMetaOf({ seatUsed: 12, seatLimit: 0 })).toEqual({ unlimited: true, free: null, pct: null })
  })
})
