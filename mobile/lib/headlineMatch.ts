// Lesen Teil 1 telc — nối tiêu đề với đoạn văn theo mẫu v3.4 `lesen1` (20/11/2026): ô "Chọn tiêu đề"
// dưới từng đoạn, khay 10 tiêu đề. Logic thuần (giống `pick` của web `ObjectiveTeilView`): mỗi tiêu đề
// dùng một lần — chọn tiêu đề đang nằm ở đoạn khác thì CHUYỂN nó sang đoạn này; chọn lại đúng tiêu đề
// đang có thì bỏ chọn; chọn xong tự sang đoạn kế chưa có.

/** Giá trị rỗng = bỏ chọn câu đó (màn cha xoá khoá khỏi bộ đáp án). */
export const CLEARED = ''

/** Đoạn kế tiếp chưa có tiêu đề kể từ sau `afterId` (vòng lại từ đầu), không tính `afterId`; `null` khi đủ. */
export function nextOpenItem(itemIds: readonly string[], answers: Record<string, string>, afterId: string | null): string | null {
  const n = itemIds.length
  if (n === 0) return null
  const start = afterId == null ? -1 : itemIds.indexOf(afterId)
  for (let k = 1; k <= n; k++) {
    const id = itemIds[(start + k + n) % n]
    if (id !== afterId && !(answers[id] ?? '').trim()) return id
  }
  return null
}

/** Đoạn KHÁC đang giữ tiêu đề `key`. */
export function holderOf(itemIds: readonly string[], answers: Record<string, string>, key: string, exceptId: string): string | null {
  return itemIds.find((id) => id !== exceptId && answers[id] === key) ?? null
}

/** Các tiêu đề đã gắn vào đoạn nào đó (để khay hiện viền đứt). */
export function usedHeadlines(itemIds: readonly string[], answers: Record<string, string>): Set<string> {
  const out = new Set<string>()
  for (const id of itemIds) {
    const v = answers[id]
    if (v && v.trim()) out.add(v)
  }
  return out
}

/**
 * Chọn tiêu đề `key` cho đoạn `activeId`. Trả các thay đổi đáp án theo thứ tự cần gửi (`CLEARED` = bỏ chọn)
 * và đoạn nên mở tiếp (`null` = đã đủ, đóng khay).
 */
export function pickHeadline(
  itemIds: readonly string[],
  answers: Record<string, string>,
  activeId: string,
  key: string,
): { changes: [string, string][]; next: string | null } {
  if (answers[activeId] === key) {
    // Chạm lại tiêu đề đang có ⇒ bỏ chọn, ở lại đoạn này.
    return { changes: [[activeId, CLEARED]], next: activeId }
  }
  const changes: [string, string][] = []
  const holder = holderOf(itemIds, answers, key, activeId)
  if (holder) changes.push([holder, CLEARED])
  changes.push([activeId, key])
  const after = { ...answers, [activeId]: key }
  if (holder) delete after[holder]
  return { changes, next: nextOpenItem(itemIds, after, activeId) }
}

/** Số đoạn đã có tiêu đề. */
export function answeredItems(itemIds: readonly string[], answers: Record<string, string>): number {
  return itemIds.filter((id) => (answers[id] ?? '').trim()).length
}
