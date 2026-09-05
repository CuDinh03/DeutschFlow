import { revealScrollDelta, revealScrollOffset } from '../spotlightReveal'

// Dải dọc (toạ độ window) mà ô khoét phải nằm gọn: dưới safe-area, trên thanh tab nổi.
const band = { top: 60, bottom: 750 }

describe('revealScrollDelta', () => {
  test('ô khoét đã nằm gọn trong dải (kể cả lề) → 0, không cuộn', () => {
    expect(revealScrollDelta({ cutout: { y: 300, height: 100 }, band, margin: 12 })).toBe(0)
  })

  test('ô khoét nằm dưới đáy màn (thẻ Ôn tập bị lấp) → cuộn xuống để tâm ô về giữa dải', () => {
    // tâm ô = 940, tâm dải = 405 → nội dung phải chạy lên 535pt
    expect(revealScrollDelta({ cutout: { y: 900, height: 80 }, band })).toBe(535)
  })

  test('ô khoét chỉ lòi mép trên (bị thanh tab che phần dưới) → vẫn phải cuộn', () => {
    expect(revealScrollDelta({ cutout: { y: 700, height: 100 }, band })).toBeGreaterThan(0)
  })

  test('ô khoét đã cuộn quá lên trên dải → cuộn ngược (âm)', () => {
    expect(revealScrollDelta({ cutout: { y: -50, height: 80 }, band })).toBeLessThan(0)
  })

  test('lề: đáy ô lọt vào vùng lề sát đáy dải → coi như chưa gọn', () => {
    // đáy ô 745 > 750 − 12 = 738
    expect(revealScrollDelta({ cutout: { y: 660, height: 85 }, band, margin: 12 })).toBeGreaterThan(0)
  })

  test('ô cao hơn cả dải → canh giữa (không có cách nào gọn)', () => {
    expect(revealScrollDelta({ cutout: { y: 100, height: 900 }, band })).toBe(550 - 405)
  })
})

describe('revealScrollOffset', () => {
  test('không cần cuộn → null', () => {
    expect(revealScrollOffset({ cutout: { y: 300, height: 100 }, band, viewportTop: 0, innerTop: -200 })).toBeNull()
  })

  test('offset mới = offset hiện tại (viewportTop − innerTop) + delta', () => {
    // đang ở offset 200, ô ở y=900 → delta 535 → 735
    expect(revealScrollOffset({ cutout: { y: 900, height: 80 }, band, viewportTop: 0, innerTop: -200 })).toBe(735)
  })

  test('ScrollView không nằm sát mép trên màn (có header) → offset vẫn tính theo viewportTop', () => {
    // viewport bắt đầu ở 100, inner ở −50 → offset hiện tại 150; ô ở 900 → delta 535 → 685
    expect(revealScrollOffset({ cutout: { y: 900, height: 80 }, band, viewportTop: 100, innerTop: -50 })).toBe(685)
  })

  test('đang ở đầu trang mà ô "trên" dải (bị safe-area che) → không có gì để cuộn → null', () => {
    expect(revealScrollOffset({ cutout: { y: 20, height: 30 }, band, viewportTop: 0, innerTop: 0 })).toBeNull()
  })

  test('cuộn ngược bị kẹp về 0 khi delta âm lớn hơn offset hiện tại', () => {
    expect(revealScrollOffset({ cutout: { y: -300, height: 40 }, band, viewportTop: 0, innerTop: -100 })).toBe(0)
  })
})
