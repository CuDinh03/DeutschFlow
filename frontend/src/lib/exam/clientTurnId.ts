/**
 * Khoá idempotency cho MỘT lượt nói logic trong phòng luyện thi (audit 31/08 F-06): sinh một lần khi
 * người học bấm gửi, dùng lại NGUYÊN khoá khi "Gửi lại" sau timeout/rớt mạng. Backend replay phản hồi
 * đầu nếu đã xử lý xong, nên retry không bao giờ thành lượt thứ hai (không trừ quota đôi, step không nhảy).
 *
 * Tách khỏi examSpeakingApi để test mock module API không phải khai lại hàm này.
 */
export function newClientTurnId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
