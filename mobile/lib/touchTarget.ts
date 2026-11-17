// Vùng chạm tối thiểu theo Hướng dẫn giao diện của Apple: 44 × 44 pt.
export const MIN_TOUCH_PT = 44

/** hitSlop mỗi phía để một icon cỡ `size` pt có vùng chạm ≥ 44 pt; không nhỏ hơn 8. */
export function iconHitSlop(size: number): number {
  return Math.max(8, Math.ceil((MIN_TOUCH_PT - size) / 2))
}
