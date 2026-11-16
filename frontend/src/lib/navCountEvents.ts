/**
 * Yêu cầu các số đếm cạnh mục menu (NavCount) tải lại ngay, không chờ đổi trang.
 * Dùng sau thao tác làm đổi số đếm mà vẫn đứng nguyên trang, ví dụ admin mở một góp ý chưa đọc.
 */
export const NAV_COUNT_REFRESH_EVENT = 'df:nav-count-refresh'

export function requestNavCountRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NAV_COUNT_REFRESH_EVENT))
}
