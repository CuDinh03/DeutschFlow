/**
 * Đọc `audit_logs.metadata_json` thành cặp khoá–giá trị hiển thị được.
 *
 * Cột này là nơi DUY NHẤT ghi "đã đổi cái gì thành cái gì" (ví dụ `admin.org.updated` mang
 * fromStatus/toStatus/seatLimit). Trước đợt này màn sổ bỏ hẳn cột đó, nên giám đốc chỉ thấy tên sự
 * kiện mà không biết hệ quả. Đổ JSON thô ra bảng thì đúng dữ liệu nhưng không đọc được, nên tách
 * thành cặp.
 *
 * 🪤 metadata do ~60 điểm gọi tự đặt, KHÔNG có schema chung: có chỗ ghi map phẳng, có chỗ ghi mảng,
 * có dòng cũ ghi chuỗi không phải JSON. Vì vậy hàm này KHÔNG BAO GIỜ ném lỗi và không bao giờ nuốt
 * dữ liệu: parse hỏng hoặc không phải object thì trả về đúng một cặp không khoá mang nguyên văn,
 * để dòng vết vẫn còn bằng chứng thay vì biến mất khỏi giao diện.
 */

/** Một cặp đã chuẩn hoá: `label` để hiện, `value` đã cắt ngắn, `full` cho tooltip/title. */
export interface AuditMetaPair {
  key: string
  label: string
  value: string
  full: string
}

/** Ngưỡng cắt giá trị dài (id dài, JSON lồng) để một dòng bảng không kéo dài vô hạn. */
const MAX_VALUE_CHARS = 80

/**
 * `fromStatus` → `From status`, `seat_limit` → `Seat limit`.
 *
 * Khoá metadata do máy chủ đặt, tập hợp KHÔNG đóng (mỗi điểm gọi tự chọn tên) nên không thể dịch
 * qua catalog — chỉ tách chữ cho dễ đọc. Đây là dữ liệu, không phải chuỗi giao diện.
 */
export function humanizeMetaKey(key: string): string {
  const words = key
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

function stringifyValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  return JSON.stringify(raw) ?? ''
}

function truncate(text: string): string {
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text
}

function pair(key: string, raw: unknown): AuditMetaPair {
  const full = stringifyValue(raw)
  return { key, label: key ? humanizeMetaKey(key) : '', value: truncate(full), full }
}

/**
 * `metadata_json` → danh sách cặp. Rỗng/null/`{}` → mảng rỗng (màn hiện dấu gạch).
 * Giá trị null/undefined/chuỗi rỗng bị bỏ: chúng chỉ làm nhiễu chứ không nói thêm điều gì.
 */
export function parseAuditMetadata(rawJson: string | null | undefined): AuditMetaPair[] {
  const text = rawJson?.trim()
  if (!text) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return [pair('', text)]
  }

  if (parsed === null || typeof parsed !== 'object') return [pair('', stringifyValue(parsed))]
  if (Array.isArray(parsed)) return parsed.length === 0 ? [] : [pair('', stringifyValue(parsed))]

  return Object.entries(parsed as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => pair(k, v))
}
