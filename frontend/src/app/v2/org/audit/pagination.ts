/**
 * Cỡ trang sổ hoạt động trung tâm. Tách khỏi `page.tsx` vì Next.js chỉ cho phép các export cố
 * định (default, metadata…) ở file page — export thêm làm `next build` đỏ ở bước type check.
 *
 * Máy chủ chặn trần `size` ở 100 (`AuditLogService.MAX_PAGE_SIZE`); 30 là con số cùng nhịp với
 * màn nhật ký của ADMIN.
 */
export const ORG_AUDIT_PAGE_SIZE = 30
