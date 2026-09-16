/**
 * Múi giờ chọn được cho thông báo hằng ngày.
 *
 * <p>Danh sách NGẮN có chủ đích thay vì đổ hết ~400 zone của {@code Intl.supportedValuesOf}: học
 * viên DeutschFlow gần như chỉ ở Việt Nam hoặc vùng nói tiếng Đức, và một ô chọn 400 dòng thì
 * không ai tìm nổi zone của mình. Zone lạ vẫn không bị mất — xem {@link timezoneOptionsFor}.
 *
 * <p>Nhãn để nguyên tên thành phố (danh từ riêng, không dịch), phần mô tả do i18n lo.
 */
export const TIMEZONE_OPTIONS: readonly string[] = [
  'Asia/Ho_Chi_Minh',
  'Europe/Berlin',
  'Europe/Vienna',
  'Europe/Zurich',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Taipei',
  'Australia/Sydney',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

/**
 * Tên cũ (alias IANA) → tên chuẩn đang dùng trong danh sách trên.
 *
 * <p>🪤 Cần có vì trình duyệt trả tên NÀO tuỳ hệ điều hành: máy thử ở Việt Nam báo
 * {@code Asia/Saigon}, không phải {@code Asia/Ho_Chi_Minh}. Thiếu bảng này thì ô chọn hiện cả hai
 * dòng cho CÙNG một múi giờ — người dùng không biết chọn dòng nào mới đúng.
 */
const ALIASES: Record<string, string> = {
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Europe/Kiev': 'Europe/Kyiv',
  'US/Pacific': 'America/Los_Angeles',
  'US/Eastern': 'America/New_York',
  Etc_UTC: 'UTC',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
}

/** Đưa một tên múi giờ về dạng chuẩn mà danh sách trên đang dùng. */
export function canonicalTimezone(zone: string): string {
  return ALIASES[zone] ?? zone
}

/** Múi giờ của chính thiết bị đang mở trang — null khi trình duyệt không nói. */
export function deviceTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone ? canonicalTimezone(zone) : null
  } catch {
    return null
  }
}

/**
 * Danh sách hiển thị = danh sách chuẩn + zone đang lưu + zone của thiết bị (nếu chưa có).
 *
 * <p>Không gộp hai giá trị kia vào thì một người đang ở {@code Europe/Prague} sẽ thấy ô chọn nhảy
 * sang Asia/Ho_Chi_Minh và lặng lẽ ghi đè cài đặt của họ ngay lần lưu kế tiếp.
 */
export function timezoneOptionsFor(current: string | null): string[] {
  const extras = [current && canonicalTimezone(current), deviceTimezone()].filter(
    (zone): zone is string => !!zone && !TIMEZONE_OPTIONS.includes(zone)
  )
  // Lọc trùng bằng indexOf chứ không spread Set: target tsconfig của repo là ES5 nên `[...new Set()]`
  // đỏ TS2802 (bẫy đã gặp ở các file khác).
  return [...TIMEZONE_OPTIONS, ...extras].filter((zone, i, all) => all.indexOf(zone) === i)
}
