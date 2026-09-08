/**
 * Trạng thái nguồn dữ liệu phụ trên bảng điều khiển trung tâm (OWNER + MANAGER dùng chung).
 *
 * Khuôn này có từ đợt 0 OWNER (F02) và nay là khuôn chung: một API phụ chết thì thẻ của nó nói
 * "chưa tải được" + có nút Thử lại, KHÔNG được biến thành `null`/`[]` rồi hiện ra như số 0. Bảng
 * MANAGER trước đây `getAnalytics().catch(() => null)` + `?? 0`, nên analytics chết là màn hình
 * khẳng định "0 học viên, không có việc cần xử lý" — một kết luận dựng từ chỗ không có dữ liệu.
 */

/** Một nguồn dữ liệu phụ: còn chờ / đã có / lỗi. */
export type Src<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error' }

/** Đổi một kết quả `Promise.allSettled` thành `Src` — lỗi ở lại là LỖI. */
export function srcOf<T>(r: PromiseSettledResult<T>): Src<T> {
  return r.status === 'fulfilled' ? { state: 'ok', data: r.value } : { state: 'error' }
}

