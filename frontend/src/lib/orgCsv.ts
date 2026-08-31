import type { OrgMember } from '@/lib/orgApi'

/**
 * orgCsv — xuất danh sách học viên của tổ chức ra CSV (Đợt 0 OWNER, F03).
 *
 * Xuất CHÍNH XÁC những dòng đang hiển thị (đã lọc theo ô tìm kiếm) — trang Students
 * tải trọn danh sách qua GET /org/members nên dữ liệu phía client là đầy đủ, không
 * phải trang đầu của một danh sách phân trang.
 */

/** Escape một ô CSV: bọc ngoặc kép khi chứa dấu phẩy/ngoặc kép/xuống dòng. */
function cell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * Sinh nội dung CSV (kèm BOM để Excel nhận UTF-8 tiếng Việt).
 * Cột cố định: Tên hiển thị, Email, Trạng thái, Ngày tham gia (ISO).
 */
export function studentsToCsv(members: OrgMember[]): string {
  const header = ['Tên hiển thị', 'Email', 'Trạng thái', 'Ngày tham gia']
  const rows = members.map((m) => [m.displayName ?? '', m.email, m.status, m.joinedAt ?? ''])
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** Tải một chuỗi văn bản xuống trình duyệt dưới dạng file. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
