import { splashTileSize } from '@/lib/splashGeometry'

describe('splashTileSize — ô màn chờ động khớp ô màn chờ native (cover)', () => {
  test('iPhone 15 (393×852): theo chiều cao', () => {
    expect(splashTileSize(393, 852)).toBe(88)
  })

  test('iPhone SE (375×667): màn thấp hơn tỉ lệ ảnh nên theo chiều rộng', () => {
    expect(splashTileSize(375, 667)).toBe(84)
  })

  test('iPhone 15 Pro Max (430×932)', () => {
    expect(splashTileSize(430, 932)).toBe(97)
  })
})
