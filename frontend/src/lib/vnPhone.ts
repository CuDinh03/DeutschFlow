/**
 * Chuẩn hoá + kiểm tra số điện thoại di động Việt Nam.
 *
 * QA 2026-09-01 (F-07): form đăng ký kiểm regex trên chuỗi THÔ, nên `0912 345 678` — đúng cách
 * người Việt vẫn gõ, và cũng là cách autofill của trình duyệt chèn — bị chặn. Tệ hơn: chuỗi LỖI
 * (`register.phoneInvalid`) khi đó trùng y hệt chuỗi GỢI Ý (`register.phoneHint`), nên người dùng
 * đọc được đúng cái mình vừa làm ("10 chữ số bắt đầu bằng 09") mà vẫn bị chặn, không có manh mối
 * nào chỉ ra thủ phạm là dấu cách ⇒ ngõ cụt đăng ký.
 *
 * QA 2026-09-01 (F-08): backend đã `.trim()` email + phone trong compact constructor của
 * `RegisterRequest`, nên form còn CHẶT HƠN backend — ` 0912345678 ` bị frontend từ chối dù backend
 * chấp nhận. Chuẩn hoá ở đây khép lại cả hai khoảng lệch.
 */

/** Ký tự phân tách mà người dùng hay chèn giữa các cụm số. */
const SEPARATORS = /[\s.\-()]/g

/** Đầu số di động Việt Nam, 10 chữ số: 03, 05, 07, 08, 09. */
export const VN_PHONE_RE = /^0[35789]\d{8}$/

/**
 * Bỏ ký tự phân tách và quy mã quốc gia về dạng nội địa.
 *
 * `+84912345678` và `84912345678` → `0912345678`. Nhánh `84` có ràng buộc độ dài 11 để không
 * cắt nhầm số nội địa hợp lệ bắt đầu bằng `08` (số nội địa luôn mở đầu bằng `0`, nên thực tế
 * không đụng nhau, nhưng ràng buộc này khiến ý định của hàm rõ ràng mà không cần đọc chú thích).
 */
export function normalizeVnPhone(raw: string): string {
  const compact = (raw ?? '').replace(SEPARATORS, '')
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`
  if (compact.startsWith('84') && compact.length === 11) return `0${compact.slice(2)}`
  return compact
}

/** Số hợp lệ sau khi chuẩn hoá. Dùng chung cho cả validate lẫn giá trị gửi lên backend. */
export function isValidVnPhone(raw: string): boolean {
  return VN_PHONE_RE.test(normalizeVnPhone(raw))
}
