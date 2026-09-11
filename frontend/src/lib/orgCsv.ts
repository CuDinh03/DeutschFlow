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
 *
 * ⛔ KHÔNG thêm `birthDate` vào đây (owner chốt 09/09/2026, Gói 1). Nút "Xuất danh sách" trên trang
 * Học viên mở được với BẤT KỲ giáo viên/quản lý nào, nên thêm cột ngày sinh là biến một tệp danh
 * sách lớp thành tệp PII của trẻ vị thành niên tải về máy cá nhân. Ai cần ngày sinh thì đi đường
 * riêng có kiểm quyền và có vết audit, không đi qua nút xuất chung này.
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

// ─── Nhập roster CSV (PR-A5 07/09/2026; cột vị thành niên Gói 1 09/09/2026; D1/R11 10/09/2026; R6) ───
// Backend `POST /org/students/import` nhận `email,displayName[,phone]` và — khi header khai thêm —
// `birthDate` + các cột người giám hộ (`guardianName`, `guardianRelationship`, `guardianPhone`,
// `guardianEmail`) + hai ô đồng ý `consentConfirmed` (ghi âm, mục C1 phiếu giấy) và
// `reportSharingConfirmed` (chia sẻ phiếu đánh giá với người giám hộ, mục C2 — scope
// `GUARDIAN_REPORT_SHARING`); máy chủ trả lỗi TỪNG DÒNG. Phần dưới chỉ để XEM TRƯỚC phía client (đếm
// dòng, báo email/ngày sai sớm) — không thay kiểm tra của máy chủ.
//
// 🔑 Cột mới là TÙY CHỌN: tệp không khai `birthDate`, `consentConfirmed` lẫn `reportSharingConfirmed`
// vẫn đọc y hệt trước, vì tệp CSV các trung tâm đang dùng không được vỡ. Ghi danh KHÔNG phải cổng chặn
// — học viên thiếu ngày sinh hay thiếu đồng ý vẫn vào được, cổng nằm ở đường dữ liệu đi ra nhà cung
// cấp AI (chỉ khoá phần nói).

export interface RosterRow {
  email: string
  displayName: string
  phone: string
  /**
   * Ngày sinh THÔ đúng như trong tệp (chưa chuẩn hoá), chỉ có khi header khai cột `birthDate`.
   *
   * `undefined` = tệp KHÔNG khai cột này; `''` = có cột nhưng ô để trống. Hai ca đó khác nhau về
   * nghiệp vụ (tệp cũ chưa biết gì về ngày sinh ≠ trung tâm cố tình bỏ trống một dòng) nên không
   * gộp cả hai vào chuỗi rỗng.
   */
  birthDate?: string
  /** Họ tên người giám hộ — chỉ có khi header khai cột `guardianName`. */
  guardianName?: string
  /**
   * Quan hệ với học viên, NGUYÊN VĂN như trong tệp. Máy chủ nhận cả `MOTHER|FATHER|LEGAL_GUARDIAN|
   * OTHER` lẫn bí danh tiếng Việt (mẹ, cha/bố, người giám hộ, khác) rồi mới quy về enum của V319.
   */
  guardianRelationship?: string
  guardianPhone?: string
  /** Email người giám hộ (R11) — chỉ có khi header khai cột `guardianEmail`. */
  guardianEmail?: string
  /**
   * Ô "đã xác nhận đồng ý" NGUYÊN VĂN (D1). Máy chủ nhận `true/yes/1/x/có/đã thu…` là có,
   * `false/no/0/không/chưa` và ô trống là không, giá trị khác thì từ chối dòng — web KHÔNG tự diễn
   * giải, chỉ hiện lại để người nhập soi trước khi tải lên.
   */
  consentConfirmed?: string
  /**
   * Ô "đã xác nhận đồng ý chia sẻ phiếu đánh giá" NGUYÊN VĂN (R6, mục C2 của phiếu giấy). Cùng bộ
   * có/không với `consentConfirmed` ở máy chủ, nhưng ĐỘC LẬP: đánh C2 không suy ra C1 và ngược lại.
   */
  reportSharingConfirmed?: string
  /**
   * Ô "đã xác nhận đồng ý cho AI chấm bài làm" NGUYÊN VĂN (C3 của phiếu giấy `2026-10`, scope
   * `AI_PROCESSING`). Cùng bộ có/không, ĐỘC LẬP với hai ô kia: thiếu ô này thì bài viết của học viên
   * vị thành niên do giáo viên chấm tay, không phải mất tính năng.
   */
  aiProcessingConfirmed?: string
  /** Số dòng trong file gốc (1-based, tính cả header/dòng trống) — để người dùng dò lại trong Excel. */
  line: number
}

export interface RosterParse {
  hasHeader: boolean
  rows: RosterRow[]
  /** Số dòng có email không hợp lệ theo kiểm tra sơ bộ phía client. */
  invalidEmails: number
  /** Header có khai cột `birthDate` không — quyết định cả cách đọc cột lẫn cột hiện ở xem trước. */
  hasBirthDate: boolean
  /** Header có khai ít nhất một cột người giám hộ không. */
  hasGuardian: boolean
  /** Header có khai cột `consentConfirmed` (hoặc bí danh) không — cột này cũng bật chế độ đọc theo tên. */
  hasConsent: boolean
  /** Header có khai cột `reportSharingConfirmed` (hoặc bí danh) không — cũng bật chế độ đọc theo tên (R6). */
  hasReportSharing: boolean
  /** Header có khai cột `aiProcessingConfirmed` (hoặc bí danh) không — cũng bật chế độ đọc theo tên (C3). */
  hasAiProcessing: boolean
  /** Số dòng có ngày sinh SAI ĐỊNH DẠNG (không phải YYYY-MM-DD). Ô trống KHÔNG tính là sai. */
  invalidBirthDates: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * "Không phải chữ/số" cho `normalizeHeader`, áp SAU khi đã bỏ dấu (NFD + bỏ combining mark). Liệt kê
 * dải Latin thay vì `\p{L}\p{N}`: thuộc tính Unicode đòi cờ `u`, mà `tsconfig` của frontend không
 * đặt `target` nên mặc định ES5 và `tsc` chặn thẳng bằng TS1501.
 *
 * Chênh với `Character.isLetterOrDigit` của backend chỉ ở các bảng chữ ngoài Latin (Hy Lạp, Kirin…).
 * Không đổi kết quả nào: mọi tên cột hệ thống hiểu đều là ASCII sau khi bỏ dấu, nên một tiêu đề chứa
 * ký tự như vậy không khớp khoá nào ở cả hai phía.
 */
const NON_ALNUM_RE = /[^0-9A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g
/** Dấu thanh/dấu mũ sau NFD (combining diacritical marks). */
const COMBINING_RE = /[\u0300-\u036f]/g

/**
 * Ngày có đúng dạng `YYYY-MM-DD` và có thật trên lịch không.
 *
 * Chỉ kiểm ĐỊNH DẠNG, cố ý KHÔNG tính tuổi: "chưa thành niên" chỉ được suy ở một nơi duy nhất là
 * `MinorPolicy` phía máy chủ (ghim `Asia/Ho_Chi_Minh`). Tính tuổi thêm một lần ở trình duyệt —
 * chạy theo múi giờ của máy người dùng — là dựng nguồn sự thật thứ hai về tuổi, đúng thứ V319 đi
 * tránh. Ở đây chỉ bắt lỗi gõ tay để người dùng sửa trước khi tải lên.
 *
 * Bắt được cả `2026-02-30` lẫn thói quen xuất `01/09/2026` của Excel bản tiếng Việt.
 */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

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

/** Một bản ghi CSV kèm số dòng VẬT LÝ nơi nó bắt đầu (1-based, tính cả header). */
export interface CsvRecord {
  text: string
  line: number
}

/**
 * Tách văn bản CSV thành từng BẢN GHI, tôn trọng ô bọc nháy.
 *
 * Vì sao không dùng `split(/\r?\n/)`: RFC 4180 cho phép ô bọc nháy CHỨA ký tự xuống dòng, ví dụ
 * `foo@x.com,"Dòng1<LF>Dòng2",0912`. Cắt theo ký tự xuống dòng trước rồi mới tách cột sẽ chẻ ô đó
 * làm đôi: nửa đầu vẫn có email hợp lệ nên **âm thầm tạo tài khoản với tên cụt**, nửa sau thành một
 * dòng lỗi ma không tương ứng dữ liệu nào. Đây là sai lệch dữ liệu im lặng, không phải lỗi lộ ra.
 *
 * `line` là dòng vật lý nơi bản ghi BẮT ĐẦU, để người dùng dò lại đúng chỗ trong Excel. Bản ghi
 * trải nhiều dòng thì vẫn báo dòng đầu của nó.
 */
export function splitCsvRecords(src: string): CsvRecord[] {
  const out: CsvRecord[] = []
  let cur = ''
  let quoted = false
  let physicalLine = 1
  let recordStart = 1

  const flush = () => {
    if (cur.trim() !== '') out.push({ text: cur, line: recordStart })
    cur = ''
  }

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (quoted) {
      if (c === '"') {
        // `""` là một dấu nháy nằm TRONG ô — giữ nguyên cả hai ký tự cho parseCsvLine xử lý.
        if (src[i + 1] === '"') { cur += '""'; i++ } else { quoted = false; cur += c }
      } else {
        if (c === '\n') physicalLine++
        cur += c
      }
      continue
    }

    if (c === '"') { quoted = true; cur += c; continue }

    if (c === '\r' || c === '\n') {
      if (c === '\r' && src[i + 1] === '\n') i++
      flush()
      physicalLine++
      recordStart = physicalLine
      continue
    }

    cur += c
  }
  flush()
  return out
}

/**
 * Bỏ dấu tiếng Việt, bỏ MỌI ký tự không phải chữ/số rồi hạ chữ thường — `Birth Date`, `birth_date`,
 * `BIRTHDATE` về một khoá; `Đã xác nhận đồng ý` → `daxacnhandongy`. Cố ý chép đúng
 * `RosterColumnLayout.normalize` của backend (NFD + bỏ combining mark + đ→d + `isLetterOrDigit`): web
 * chuẩn hoá rộng hơn máy chủ thì xem trước nhận một cột mà máy chủ bỏ qua; hẹp hơn thì ngược lại.
 * Cả hai đều sai lệch im lặng giữa bảng xem trước và kết quả nhập.
 */
export function normalizeHeader(name: string): string {
  return name
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(COMBINING_RE, '')
    .replace(NON_ALNUM_RE, '')
    .toLowerCase()
}

/**
 * Tên cột máy chủ hiểu — chép từ `RosterColumnLayout` (KNOWN + hai danh sách bí danh). Phải TRÙNG
 * KHÍT: web nhận thêm một bí danh mà máy chủ không nhận thì xem trước hiện đúng dữ liệu còn máy chủ
 * lặng lẽ bỏ qua cột đó. Thứ tự trong mỗi danh sách bí danh là thứ tự ưu tiên khi tệp có nhiều cột
 * cùng nghĩa — cũng chép từ máy chủ.
 */
const BIRTH_DATE_KEY = 'birthdate'
const GUARDIAN_EMAIL_KEYS = ['guardianemail', 'emailgiamho', 'emailnguoigiamho'] as const
const CONSENT_KEYS = [
  'consentconfirmed', 'consent', 'guardianconsent', 'consentgranted',
  'dongy', 'dadongy', 'xacnhandongy', 'daxacnhandongy', 'dongygiamho', 'phieudongy',
] as const
/** Chép `RosterColumnLayout.REPORT_SHARING_CONFIRMED_ALIASES` — không bí danh nào trùng CONSENT_KEYS. */
const REPORT_SHARING_KEYS = [
  'reportsharingconfirmed', 'reportsharing', 'reportsharingconsent', 'guardianreportsharing',
  'chiasephieu', 'dongychiasephieu', 'chiasephieudanhgia', 'dongychiasephieudanhgia',
  'chiasephieuvoigiamho', 'guiphieuphuhuynh',
] as const
/** Chép `RosterColumnLayout.AI_PROCESSING_CONFIRMED_ALIASES` — không bí danh nào trùng hai bộ trên. */
const AI_PROCESSING_KEYS = [
  'aiprocessingconfirmed', 'aiprocessing', 'aigrading', 'aiprocessingconsent',
  'chambangai', 'dongychambangai', 'chamaibaiviet', 'dongychamai', 'aichambai',
] as const
const GUARDIAN_KEYS = ['guardianname', 'guardianphone', 'guardianrelationship', ...GUARDIAN_EMAIL_KEYS] as const
const KNOWN_KEYS = [
  'email', 'displayname', 'phone', BIRTH_DATE_KEY, ...GUARDIAN_KEYS, ...CONSENT_KEYS, ...REPORT_SHARING_KEYS,
  ...AI_PROCESSING_KEYS,
] as const

/** Vị trí của bí danh ĐẦU TIÊN khớp trong header đã chuẩn hoá, -1 nếu không có — chép `indexOfAny` máy chủ. */
function indexOfAny(headerCols: string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const i = headerCols.indexOf(alias)
    if (i >= 0) return i
  }
  return -1
}

/**
 * Đọc văn bản CSV roster: bỏ BOM, bỏ dòng trống, nhận header khi ô đầu là `email`.
 *
 * Hai chế độ đọc cột — theo quyết định của owner 09/09/2026 (cột mới TÙY CHỌN, tệp CSV trung tâm
 * đang dùng không được vỡ):
 * - Header CÓ `birthDate`, `consentConfirmed` hoặc `reportSharingConfirmed` → đọc **theo tên cột**:
 *   thứ tự tuỳ ý, thiếu cột nào thì bỏ cột đó. Hai cột đồng ý cũng bật chế độ này vì luồng "nhập
 *   roster hôm nay, vài tuần sau thu xong phiếu giấy rồi đánh dấu hàng loạt bằng tệp
 *   `email,consentConfirmed` / `email,reportSharingConfirmed`" là luồng thật — rơi về chế độ cũ là
 *   cột đồng ý bị bỏ qua IM LẶNG (máy chủ cũng bật theo các cột này).
 * - Còn lại (không header, hoặc header ba cột cũ) → đọc **theo vị trí** 0/1/2 y như trước.
 *
 * Vì sao không luôn đọc theo tên khi có header: tệp `email,phone,displayName` (đảo cột) hôm nay được
 * cả web lẫn máy chủ đọc theo VỊ TRÍ. Web tự chuyển sang đọc theo tên trong khi máy chủ vẫn đọc theo
 * vị trí thì xem trước và kết quả nhập lệch nhau, mà không chỗ nào báo lỗi.
 */
export function parseRosterCsv(text: string): RosterParse {
  const src = text.startsWith('\uFEFF') ? text.slice(1) : text
  const records = splitCsvRecords(src)
  const firstCols = records.length > 0 ? parseCsvLine(records[0].text.trim()) : []

  // Header là bản ghi ĐẦU TIÊN và chỉ khi ô đầu của nó đúng chữ `email`. Chốt này dùng `trim` +
  // so sánh không phân biệt hoa thường — KHÔNG dùng `normalizeHeader` — vì backend
  // `RosterColumnLayout.isHeader` cũng vậy. Nới ở đây mà máy chủ không nới thì web coi dòng đầu là
  // tiêu đề còn máy chủ nhập nó thành một học viên tên "displayName".
  const hasHeader = (firstCols[0] ?? '').trim().toLowerCase() === 'email'
  const headerCols = hasHeader ? firstCols.map(normalizeHeader) : []
  const hasBirthDate = headerCols.includes(BIRTH_DATE_KEY)
  const consentAt = indexOfAny(headerCols, CONSENT_KEYS)
  const hasConsent = consentAt >= 0
  const reportSharingAt = indexOfAny(headerCols, REPORT_SHARING_KEYS)
  const hasReportSharing = reportSharingAt >= 0
  const aiProcessingAt = indexOfAny(headerCols, AI_PROCESSING_KEYS)
  const hasAiProcessing = aiProcessingAt >= 0
  // Chế độ đọc theo tên — chép `RosterColumnLayout.readsMinorColumns` của máy chủ.
  const minorMode = hasBirthDate || hasConsent || hasReportSharing || hasAiProcessing
  // Cột giám hộ chỉ được đọc KHI tệp ở chế độ mới, vì backend `fromHeader` trả thẳng `legacy()`
  // khi thiếu cả `birthDate` lẫn `consentConfirmed` — lúc đó mọi vị trí giám hộ là -1. Bỏ điều kiện
  // này thì tệp có `guardianName` mà không có hai cột kia sẽ hiện cột giám hộ ở xem trước trong khi
  // máy chủ không đọc ô nào của nó: trung tâm tin là đã khai người giám hộ, thực tế chưa lưu gì.
  const hasGuardian = minorMode && GUARDIAN_KEYS.some((k) => headerCols.includes(k))

  // Vị trí mặc định chỉ dùng được khi CHƯA có cột tên khác đứng ở đó — chép `orDefault` của backend.
  // Tệp `email,fullName,birthDate`: máy chủ vẫn lấy tên hiển thị ở cột 1 (vì "fullName" không phải
  // tên cột nó biết, nên chỗ đó chưa có chủ). Web bỏ qua thì xem trước hiện tên rỗng còn bản nhập
  // vào lại có tên — người dùng không có cách nào biết mình vừa nhập gì.
  const claimed = new Set(KNOWN_KEYS.map((k) => headerCols.indexOf(k)).filter((i) => i >= 0))
  const columnAt = (key: string, fallback = -1): number => {
    const found = headerCols.indexOf(key)
    if (found >= 0) return found
    return fallback >= 0 && !claimed.has(fallback) ? fallback : -1
  }
  const emailAt = columnAt('email', 0)
  const nameAt = columnAt('displayname', 1)
  const phoneAt = columnAt('phone')
  const cellAt = (cols: string[], i: number): string | undefined => (i === -1 ? undefined : (cols[i] ?? '').trim())

  const rows: RosterRow[] = []
  let invalidEmails = 0
  let invalidBirthDates = 0

  records.forEach((rec, idx) => {
    if (idx === 0 && hasHeader) return
    const cols = parseCsvLine(rec.text.trim())

    // Chế độ CŨ — đọc theo VỊ TRÍ. Giữ nguyên từng chi tiết, kể cả việc bỏ qua cột thứ tư trở đi.
    if (!minorMode) {
      const legacyEmail = (cols[0] ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(legacyEmail)) invalidEmails++
      rows.push({ email: legacyEmail, displayName: (cols[1] ?? '').trim(), phone: (cols[2] ?? '').trim(), line: rec.line })
      return
    }

    const email = (cellAt(cols, emailAt) ?? '').toLowerCase()
    if (!EMAIL_RE.test(email)) invalidEmails++
    const birthDate = cellAt(cols, headerCols.indexOf(BIRTH_DATE_KEY)) ?? ''
    // Ô TRỐNG là hợp lệ (chưa khai); chỉ ô có chữ mà sai dạng mới bị đếm.
    if (birthDate !== '' && !isIsoDate(birthDate)) invalidBirthDates++

    const row: RosterRow = {
      email,
      displayName: cellAt(cols, nameAt) ?? '',
      phone: cellAt(cols, phoneAt) ?? '',
      birthDate,
      line: rec.line,
    }
    const guardianName = cellAt(cols, headerCols.indexOf('guardianname'))
    if (guardianName !== undefined) row.guardianName = guardianName
    // Giữ NGUYÊN VĂN ô quan hệ: máy chủ nhận cả bí danh tiếng Việt ("mẹ", "bố", "người giám hộ") và
    // tự quy về enum. Web hoa hoá hay tự dịch ở đây là dựng bộ quy tắc thứ hai, lệch lúc nào không hay.
    const relationship = cellAt(cols, headerCols.indexOf('guardianrelationship'))
    if (relationship !== undefined) row.guardianRelationship = relationship
    const guardianPhone = cellAt(cols, headerCols.indexOf('guardianphone'))
    if (guardianPhone !== undefined) row.guardianPhone = guardianPhone
    const guardianEmail = cellAt(cols, indexOfAny(headerCols, GUARDIAN_EMAIL_KEYS))
    if (guardianEmail !== undefined) row.guardianEmail = guardianEmail
    // Ô đồng ý giữ NGUYÊN VĂN — máy chủ mới là bên diễn giải có/không/từ chối (xem RosterRow).
    const consentConfirmed = cellAt(cols, consentAt)
    if (consentConfirmed !== undefined) row.consentConfirmed = consentConfirmed
    const reportSharingConfirmed = cellAt(cols, reportSharingAt)
    if (reportSharingConfirmed !== undefined) row.reportSharingConfirmed = reportSharingConfirmed
    const aiProcessingConfirmed = cellAt(cols, aiProcessingAt)
    if (aiProcessingConfirmed !== undefined) row.aiProcessingConfirmed = aiProcessingConfirmed
    rows.push(row)
  })

  return {
    hasHeader, rows, invalidEmails, hasBirthDate, hasGuardian, hasConsent, hasReportSharing,
    hasAiProcessing, invalidBirthDates,
  }
}

/**
 * File mẫu tải về (BOM cho Excel) — ba cột cũ ĐỨNG TRƯỚC, cột mới của Gói 1 nối vào sau, hai cột
 * của D1/R11 (`guardianEmail`, `consentConfirmed`) rồi cột R6 (`reportSharingConfirmed`) đứng cuối.
 *
 * Thứ tự đó không phải để cho đẹp: tệp mẫu tải hôm nay vẫn phải khớp quy trình cũ của trung tâm,
 * vốn quen thấy `email,displayName,phone` ở ba cột đầu. Dòng ví dụ thứ hai là ca thật đang cần: học
 * viên chưa thành niên nên có sẵn người giám hộ — thiếu thì máy chủ trả lỗi đúng dòng đó — ô
 * `consentConfirmed` = `x` là "trung tâm đã cầm phiếu giấy ký của người giám hộ" (ghi một dòng đồng ý
 * ghi âm, phương thức PAPER), ô `reportSharingConfirmed` = `x` là mục C2 của cùng phiếu (đồng ý nhận
 * phiếu đánh giá), ô `aiProcessingConfirmed` = `x` là mục C3 (đồng ý cho AI chấm bài làm). Để trống =
 * chưa ghi nhận gì, học viên vẫn vào nhưng phần nói còn khoá / phiếu đánh giá chưa gửi được về gia
 * đình / bài viết do giáo viên chấm tay.
 */
export function rosterTemplateCsv(): string {
  return '\uFEFF' + [
    'email,displayName,phone,birthDate,guardianName,guardianRelationship,guardianPhone,guardianEmail,consentConfirmed,reportSharingConfirmed,aiProcessingConfirmed',
    'hocvien@example.com,Nguyễn Văn A,0912345678,1999-04-21,,,,,,,',
    'hocvien2@example.com,"Trần, Bình",,2011-09-15,Trần Thị C,MOTHER,0987654321,tran.c@example.com,x,x,x',
  ].join('\r\n') + '\r\n'
}

/** Danh sách lỗi từng dòng do backend trả → CSV một cột để tải về đối soát. */
export function rosterErrorsCsv(errors: string[]): string {
  return '\uFEFF' + ['error', ...errors.map(cell)].join('\r\n') + '\r\n'
}
