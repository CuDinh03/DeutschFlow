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
 * Header mặc định (tiếng Việt) — trang Students truyền header đã dịch theo locale UI
 * (v2.org.students.csv; đợt 3 audit UTF-8/i18n 06/09/2026).
 */
const DEFAULT_HEADER: readonly string[] = ['Tên hiển thị', 'Email', 'Trạng thái', 'Ngày tham gia']

/**
 * Sinh nội dung CSV (kèm BOM để Excel nhận UTF-8 tiếng Việt).
 * Cột cố định: Tên hiển thị, Email, Trạng thái, Ngày tham gia (ISO) — nhãn cột lấy từ `header`.
 */
export function studentsToCsv(members: OrgMember[], header: readonly string[] = DEFAULT_HEADER): string {
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
  // Hoãn revoke một nhịp: WebKit có thể chưa kịp bắt đầu tải nếu revoke đồng bộ ngay sau click.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ─── Nhập roster CSV (PR-A5, 07/09/2026) ─────────────────────────────────────
// Backend `POST /org/students/import` nhận `email,displayName[,phone]` và trả lỗi từng dòng; phần
// dưới chỉ để XEM TRƯỚC phía client (đếm dòng, báo email sai sớm) — không thay kiểm tra của máy chủ.

export interface RosterRow {
  email: string
  displayName: string
  phone: string
  /** Số dòng trong file gốc (1-based, tính cả header/dòng trống) — để người dùng dò lại trong Excel. */
  line: number
}

export interface RosterParse {
  hasHeader: boolean
  rows: RosterRow[]
  /** Số dòng có email không hợp lệ theo kiểm tra sơ bộ phía client. */
  invalidEmails: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Tách một dòng CSV theo RFC 4180 (dấu phẩy trong ô bọc ngoặc kép không tách cột; `""` = một dấu `"`). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += c
    } else if (c === '"' && cur === '') {
      quoted = true
    } else if (c === ',') {
      out.push(cur); cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

/** Đọc văn bản CSV roster: bỏ BOM, bỏ dòng trống, nhận header khi ô đầu là `email`. */
export function parseRosterCsv(text: string): RosterParse {
  const src = text.startsWith('\uFEFF') ? text.slice(1) : text
  const rows: RosterRow[] = []
  let hasHeader = false
  let first = true
  let invalidEmails = 0
  src.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim()
    if (!line) return
    const cols = parseCsvLine(line)
    if (first) {
      first = false
      if ((cols[0] ?? '').trim().toLowerCase() === 'email') { hasHeader = true; return }
    }
    const email = (cols[0] ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) invalidEmails++
    rows.push({ email, displayName: (cols[1] ?? '').trim(), phone: (cols[2] ?? '').trim(), line: idx + 1 })
  })
  return { hasHeader, rows, invalidEmails }
}

/** File mẫu tải về (BOM cho Excel): đúng 3 cột backend nhận, có ví dụ tên chứa dấu phẩy. */
export function rosterTemplateCsv(): string {
  return '\uFEFF' + ['email,displayName,phone', 'hocvien@example.com,Nguyễn Văn A,0912345678', 'hocvien2@example.com,"Trần, Bình",'].join('\r\n') + '\r\n'
}

/** Danh sách lỗi từng dòng do backend trả → CSV một cột để tải về đối soát. */
export function rosterErrorsCsv(errors: string[]): string {
  return '\uFEFF' + ['error', ...errors.map(cell)].join('\r\n') + '\r\n'
}
