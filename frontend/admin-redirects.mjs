/**
 * Chuyển hướng các trang admin đã GỘP vào trang khác (đợt 1 "Nền móng + Người dùng", 09/11/2026).
 *
 * Vì sao 307 (`permanent: false`) chứ không 308 như legacy-redirects.mjs: 308 bị trình duyệt cache
 * VĨNH VIỄN, muốn trỏ path cũ sang đích khác sau này là không sửa được trên máy đã cache. Việc gộp
 * trang admin còn có thể đổi trong các đợt sau (tab đích, tên query), nên giữ đường lui.
 *
 * Trang gốc đã bị xoá khỏi đĩa; bảng này là thứ DUY NHẤT giữ cho bookmark của admin không rơi vào
 * 404 — đừng xoá entry kèm theo việc dọn code.
 *
 * `trailingSlash: true` (next.config.mjs) → khai báo `source` KHÔNG có dấu "/" cuối. Query string của
 * lượt truy cập được Next gộp vào đích.
 */

/** `[source, destination]` → entry redirect tạm thời. */
const toTemporary = ([source, destination]) => ({ source, destination, permanent: false })

export const ADMIN_MERGED_PAGES = [
  // "AI Token" gộp thành tab "Tổng quan" của Chi phí AI.
  ['/v2/admin/tokens', '/v2/admin/ai-usage?tab=overview'],
  // "Giáo viên tự do" thành chế độ xem của trang Người dùng (TEACHER · không thuộc trung tâm · đang hoạt động).
  ['/v2/admin/free-teachers', '/v2/admin/users?view=free-teachers'],
]

export const adminMergeRedirects = ADMIN_MERGED_PAGES.map(toTemporary)
