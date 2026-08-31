/**
 * orgSeats — semantics ghế học viên của tổ chức (Đợt 0 OWNER, F05).
 *
 * Hợp đồng backend (OrgService.getSeatUsage, B2B §4/D8): `seatLimit = 0` nghĩa là
 * KHÔNG GIỚI HẠN (remaining = null), không phải "hết ghế". Mọi màn owner phải đi qua
 * helper này thay vì tự tính `limit - used` — cách tự tính từng biến org không giới hạn
 * thành "0 ghế trống · 0% sức chứa" (báo cáo đánh giá OWNER 31/08, F05).
 */

export interface SeatMeta {
  /** true khi seatLimit = 0 — gói không giới hạn ghế. */
  unlimited: boolean
  /** Số ghế còn trống; null khi không giới hạn. */
  free: number | null
  /** % ghế đã dùng (0–100, cắt trần 100); null khi không giới hạn. */
  pct: number | null
}

/** Tính meta ghế từ (used, limit) của OrgSummary. Không âm, không chia cho 0. */
export function seatMeta(used: number, limit: number): SeatMeta {
  if (limit <= 0) return { unlimited: true, free: null, pct: null }
  const free = Math.max(0, limit - used)
  const pct = Math.min(100, Math.round((used / limit) * 100))
  return { unlimited: false, free, pct }
}
