// Khoá luật "ngón tay đang ở ô tab nào" của cử chỉ vuốt trên tab bar.

import { tabIndexForX, type TabSlot } from '@/lib/tabGesture'

// 4 ô liền nhau như hàng tab thật (row paddingHorizontal 4, mỗi ô rộng 80).
const SLOTS: TabSlot[] = [
  { x: 4, width: 80 },
  { x: 84, width: 80 },
  { x: 164, width: 80 },
  { x: 244, width: 80 },
]

describe('tabIndexForX — ô tab dưới ngón tay khi vuốt', () => {
  test('nằm trong ô nào trả ô đó (cả hai mép biên)', () => {
    expect(tabIndexForX(SLOTS, 44)).toBe(0)
    expect(tabIndexForX(SLOTS, 84)).toBe(1) // mép trái ô 1
    expect(tabIndexForX(SLOTS, 164)).toBe(2)
    expect(tabIndexForX(SLOTS, 300)).toBe(3)
  })

  test('kéo lố ra ngoài pill kẹp về ô đầu/cuối', () => {
    expect(tabIndexForX(SLOTS, -30)).toBe(0)
    expect(tabIndexForX(SLOTS, 999)).toBe(3)
  })

  test('ô chưa đo layout (undefined) bị bỏ qua, chọn ô gần nhất đã đo', () => {
    const partial: (TabSlot | undefined)[] = [SLOTS[0], undefined, SLOTS[2], SLOTS[3]]
    // px rơi vào vùng ô 1 (chưa đo) → tâm ô 0 (44) cách 66, tâm ô 2 (204) cách 94 → về ô 0.
    expect(tabIndexForX(partial, 110)).toBe(0)
    expect(tabIndexForX(partial, 180)).toBe(2)
  })

  test('chưa đo được gì → -1 (worklet bỏ qua, không di indicator)', () => {
    expect(tabIndexForX([], 50)).toBe(-1)
    expect(tabIndexForX([undefined, undefined], 50)).toBe(-1)
  })
})
