import { describe, it, expect } from 'vitest'
import { contrastRatio, personaInk, personaSoft, PAPER_BG } from '@/lib/personaPaper'
import { PERSONA_LIST } from '@/lib/personas'

describe('contrastRatio', () => {
  it('trả về 21 cho cặp đen/trắng', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('trả về 1 khi hai màu trùng nhau', () => {
    expect(contrastRatio('#2D9CDB', '#2D9CDB')).toBeCloseTo(1, 5)
  })

  it('không phụ thuộc thứ tự tham số', () => {
    expect(contrastRatio('#161513', '#FBFAF7')).toBeCloseTo(contrastRatio('#FBFAF7', '#161513'), 5)
  })
})

describe('personaInk', () => {
  it('hạ sáng accent vàng cho tới khi đạt AA trên nền giấy', () => {
    // #EAB308 chỉ đạt ~1.7:1 trên giấy — không thể dùng làm màu chữ nếu để nguyên.
    expect(contrastRatio('#EAB308', PAPER_BG)).toBeLessThan(4.5)
    expect(contrastRatio(personaInk('#EAB308'), PAPER_BG)).toBeGreaterThanOrEqual(4.5)
  })

  it('giữ nguyên accent đã đủ tương phản', () => {
    // #991B1B (Klaus) vốn đã tối, không cần đụng tới.
    expect(personaInk('#991B1B')).toBe('#991B1B')
  })

  it('giữ nguyên sắc độ khi hạ sáng', () => {
    // Accent teal phải vẫn là teal: kênh lục/lam vẫn trội hơn kênh đỏ.
    const ink = personaInk('#00BFA5')
    const r = parseInt(ink.slice(1, 3), 16)
    const g = parseInt(ink.slice(3, 5), 16)
    const b = parseInt(ink.slice(5, 7), 16)
    expect(g).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(r)
  })

  it('đưa MỌI accent persona lên chuẩn AA', () => {
    for (const persona of PERSONA_LIST) {
      expect(contrastRatio(personaInk(persona.accent), PAPER_BG)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('lùi về màu mực Galerie khi đầu vào không phải hex', () => {
    expect(personaInk('không-phải-màu')).toBe('#161513')
  })
})

describe('personaSoft', () => {
  it('đổi hex thành rgba theo độ mờ yêu cầu', () => {
    expect(personaSoft('#2D9CDB', 0.12)).toBe('rgba(45, 156, 219, 0.12)')
  })

  it('chấp nhận hex rút gọn', () => {
    expect(personaSoft('#FC0', 0.2)).toBe('rgba(255, 204, 0, 0.2)')
  })

  it('lùi về mực Galerie khi đầu vào hỏng', () => {
    expect(personaSoft('', 0.1)).toBe('rgba(22, 21, 19, 0.1)')
  })
})
