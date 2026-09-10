/**
 * Hằng số của sổ chứng nhận toàn trung tâm (DEC-20). Tách khỏi `page.tsx` vì Next.js chỉ cho phép
 * các export cố định (default, metadata…) ở file page — export thêm làm `next build` đỏ ở bước
 * type check (cùng lý do với `audit/pagination.ts`).
 */

/**
 * Cỡ trang. Máy chủ chặn trần `size` ở 100 (`OrgCertificateService.MAX_PAGE_SIZE`); 30 là con số
 * cùng nhịp với sổ hoạt động của trung tâm.
 */
export const ORG_CERTIFICATES_PAGE_SIZE = 30

/**
 * Lý do thu hồi — CÙNG ngưỡng với máy chủ (`OrgCertificateService.REASON_MIN_LENGTH` /
 * `REASON_MAX_LENGTH`, tính sau khi cắt khoảng trắng). Web khoá nút xác nhận sớm để người dùng
 * không phải chờ 400 mới biết; máy chủ vẫn là nơi quyết định.
 */
export const REVOKE_REASON_MIN = 5
export const REVOKE_REASON_MAX = 300

/**
 * Số lớp tối đa nạp cho bộ lọc lớp — MỘT request lúc mở trang. Trung tâm có nhiều lớp hơn vẫn lọc
 * được bằng ô tìm tên học viên; bộ lọc lớp là tiện ích, không phải đường duy nhất.
 */
export const CLASS_FILTER_PROBE_SIZE = 100
