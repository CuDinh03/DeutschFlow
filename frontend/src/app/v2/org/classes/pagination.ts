/**
 * Cỡ trang danh sách lớp của trung tâm (PR-A2): đủ cho trung tâm nhỏ trong một lượt, vẫn buộc
 * "Tải thêm" tường minh khi lớn hơn. Tách khỏi `page.tsx` vì Next.js chỉ cho phép các export
 * cố định (default, metadata…) ở file page — export thêm làm `next build` đỏ ở bước type check.
 */
export const CLASSES_PAGE_SIZE = 50
