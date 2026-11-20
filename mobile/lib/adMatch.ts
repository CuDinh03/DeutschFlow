// Lesen Teil 3 telc (ghép tình huống – mẩu rao vặt, `MATCH_AD_X`) chọn từ phía mẩu tin (20/11/2026, owner:
// "bấm vào mẩu tin là hiện đáp án lên để chọn"): chạm mẩu ⇒ khay 10 tình huống, chọn một tình huống là gán
// mẩu đó làm đáp án của tình huống. Hàm thuần — component ở `components/exam/AdBoard.tsx`.

import { CLEARED } from './headlineMatch'

/** Tình huống đang dùng mẩu `letter` (theo thứ tự đề). */
export function situationsOf(itemIds: readonly string[], answers: Record<string, string>, letter: string): string[] {
  return itemIds.filter((id) => answers[id] === letter)
}

/**
 * Gán mẩu `letter` cho tình huống `sitId`. Trả thay đổi đáp án theo thứ tự cần gửi (`CLEARED` = bỏ chọn):
 * - tình huống đó đang là mẩu này ⇒ bỏ chọn (chạm lại để bỏ);
 * - Teil "mỗi mẩu một lần" ⇒ tình huống khác đang giữ mẩu này bị bỏ (mẩu chuyển sang tình huống mới);
 * - đáp án cũ của `sitId` (mẩu khác hoặc `x`) bị thay.
 */
export function assignAd(
  itemIds: readonly string[],
  answers: Record<string, string>,
  sitId: string,
  letter: string,
  singleUse: boolean,
): [string, string][] {
  if (answers[sitId] === letter) return [[sitId, CLEARED]]
  const changes: [string, string][] = []
  if (singleUse) for (const id of situationsOf(itemIds, answers, letter)) if (id !== sitId) changes.push([id, CLEARED])
  changes.push([sitId, letter])
  return changes
}

/** Số tình huống hiển thị: số cuối của mã câu ("LV3-14" → 14), không thì thứ tự. */
export function situationNo(itemId: string, idx: number): string {
  return /(\d+)\s*$/.exec(itemId)?.[1] ?? String(idx + 1)
}
