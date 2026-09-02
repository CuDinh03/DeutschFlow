// Logic thuần cho cử chỉ vuốt trên tab bar — tách khỏi TabBar.tsx để test được
// (quyết định "ngón tay đang ở ô nào" không được sống vô danh trong worklet).

export interface TabSlot {
  x: number
  width: number
}

/**
 * Ô tab dưới toạ độ ngang `px` (toạ độ trong hàng tab, cùng hệ với layout các
 * ô). Mỗi ô là khoảng nửa-mở [x, x+width) — mép chung giữa hai ô liền kề thuộc
 * ô bên PHẢI, không ô nào nuốt biên của ô kế. Nằm ngoài/giữa khe thì trả ô có
 * TÂM gần nhất (kéo lố ra rìa pill vẫn kẹp về ô đầu/cuối). Chưa đo được layout
 * nào → -1.
 *
 * Được gọi từ worklet của Gesture.Pan (UI thread) — phải giữ thuần, không
 * đụng closure JS.
 */
export function tabIndexForX(slots: readonly (TabSlot | undefined)[], px: number): number {
  'worklet'
  let best = -1
  let bestDist = Number.MAX_VALUE
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    if (!s) continue
    if (px >= s.x && px < s.x + s.width) return i
    const d = Math.abs(px - (s.x + s.width / 2))
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}
