// Ô "đã viết ý này" của các Leitpunkt trong bài Viết (mẫu iOS `writing`, Đợt 4c, 19/11/2026). Chỉ lưu
// trên máy (không có API) — hàm thuần ở đây, đọc/ghi máy ở `hooks/useLeitpunktChecks.ts`.
// Lưu theo CHỮ của ý (không theo thứ tự): đề xáo thứ tự ý thì dấu vẫn đúng ý.

/**
 * Khoá SecureStore (chỉ nhận chữ, số, `.`, `-`, `_`). Gắn id người dùng: SecureStore không liệt kê được khoá
 * để dọn khi đăng xuất, nên tách theo người để tài khoản khác trên cùng máy không thấy dấu cũ.
 */
export function leitpunktStoreKey(examId: number, teilKey: string, userId?: number | null): string {
  return `df_leitpunkte_${userId ?? 0}_${examId}_${teilKey.replace(/[^A-Za-z0-9._-]/g, '_')}`
}

/** Đọc bản đã lưu: chỉ giữ ý còn có trong đề hiện tại. Hỏng ⇒ rỗng. */
export function parseChecked(raw: string | null | undefined, points: readonly string[]): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const known = new Set(points)
    return Array.from(new Set(parsed.filter((p): p is string => typeof p === 'string' && known.has(p))))
  } catch {
    return []
  }
}

export function toggleChecked(checked: readonly string[], point: string): string[] {
  return checked.includes(point) ? checked.filter((p) => p !== point) : [...checked, point]
}
