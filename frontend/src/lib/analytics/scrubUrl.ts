/**
 * Lọc URL trước khi rời trình duyệt sang analytics (QLT-20, kế hoạch A1 09/11/2026).
 *
 * Trước bản này `$current_url` mang nguyên query string, nên token kích hoạt (`/v2/activate?token=`) và
 * token mời vào trung tâm (`/v2/org/accept?token=`) nằm trong PostHog; các trang chia sẻ
 * `/phieu|report|certificate/<token>` thì lộ token qua path.
 *
 * Chọn DANH SÁCH CHO PHÉP cho query (không phải danh sách chặn): tham số mới thêm sau này mặc định bị bỏ,
 * nên một bí mật mới (mã OTP, chữ ký, `next=` mang URL khác…) không thể lọt chỉ vì quên cập nhật danh sách.
 * Fragment (`#…`) bỏ hẳn: phiên hỗ trợ trao mã qua `#code=`.
 */

/** Query giữ lại cho phân tích. Thêm khoá mới ở đây chỉ khi chắc chắn nó KHÔNG phải bí mật/PII. */
export const ALLOWED_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'examId',
  'teil',
  'provider',
  'level',
  'cefr',
  'mode',
  'tab',
  'lang',
  'topic',
  'occupation',
  'focus',
  'placement',
  'ended',
])

/** Tiền tố query giữ lại (chiến dịch quảng bá). */
const ALLOWED_QUERY_PREFIXES = ['utm_']

/**
 * Đoạn path ngay SAU các tên này là bí mật. Gồm trang công khai (`phieu`, `report`, `certificate`) và
 * API công khai tương ứng mà bản ghi phiên có thể thấy (`report-issues`, `grade-report`, `org-invitations`).
 */
export const TOKEN_PATH_SEGMENTS = [
  'phieu',
  'report',
  'certificate',
  'report-issues',
  'grade-report',
  'org-invitations',
] as const

/** Tên query chắc chắn là bí mật — dùng khi chỉ có văn bản tự do (không tách được URL) và cho posthog-js. */
export const SECRET_QUERY_PARAMS = ['token', 'code', 'otp', 'invite', 'key', 'signature'] as const

export const TOKEN_PLACEHOLDER = ':token'

const TOKEN_PATH_RE = new RegExp(`(^|/)(${TOKEN_PATH_SEGMENTS.join('|')})/[^/?#\\s"']+`, 'gi')
const SECRET_PARAM_IN_TEXT_RE = new RegExp(`([?&#])(${SECRET_QUERY_PARAMS.join('|')})=[^&#\\s"']*`, 'gi')
const ORIGIN_RE = /^((?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*)(.*)$/i
const TOKEN_PAGE_RE = /^\/(phieu|report|certificate)\/[^/]+/i

function decodeKey(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    return raw
  }
}

function isAllowedParam(rawKey: string): boolean {
  const key = decodeKey(rawKey)
  return ALLOWED_QUERY_PARAMS.has(key) || ALLOWED_QUERY_PREFIXES.some((p) => key.startsWith(p))
}

function maskTokenPath(path: string): string {
  return path.replace(TOKEN_PATH_RE, (_m, lead: string, seg: string) => `${lead}${seg}/${TOKEN_PLACEHOLDER}`)
}

/**
 * URL (tuyệt đối, `//host/…` hay tương đối) → bản an toàn để gửi analytics: bỏ fragment, chỉ giữ query
 * trong danh sách cho phép (giữ nguyên cách mã hoá gốc), thay token trong path bằng `:token`.
 * Giá trị không phải URL (`$direct`, tên miền trơn) đi qua không đổi.
 */
export function scrubUrl(url: string): string {
  const hashAt = url.indexOf('#')
  const noHash = hashAt >= 0 ? url.slice(0, hashAt) : url
  const queryAt = noHash.indexOf('?')
  const base = queryAt >= 0 ? noHash.slice(0, queryAt) : noHash
  const query = queryAt >= 0 ? noHash.slice(queryAt + 1) : ''

  const m = ORIGIN_RE.exec(base)
  const origin = m ? m[1] : ''
  const path = m ? m[2] : base

  const kept = query.split('&').filter((pair) => pair !== '' && isAllowedParam(pair.split('=')[0]))
  return origin + maskTokenPath(path) + (kept.length ? `?${kept.join('&')}` : '')
}

/**
 * Văn bản tự do có thể chứa URL (chữ trên phần tử được bấm, `$elements_chain`): không tách được URL nên
 * dùng danh sách chặn — che token trong path và giá trị của các query bí mật.
 */
export function scrubUrlsInText(text: string): string {
  return maskTokenPath(text).replace(SECRET_PARAM_IN_TEXT_RE, (_m, sep: string, name: string) => `${sep}${name}=${TOKEN_PLACEHOLDER}`)
}

/** Trang mà cả trang là nội dung riêng của một token (không ghi phiên ở đây). */
export function isTokenPagePath(pathname: string | null | undefined): boolean {
  return !!pathname && TOKEN_PAGE_RE.test(pathname)
}
