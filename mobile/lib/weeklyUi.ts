// Logic thuần cho Thử thách nói tuần và phiếu kết quả (giao diện v3.4, Đợt 5 phần C, 19/11/2026).

/** Tách 'YYYY-MM-DD' (hoặc ISO có giờ) thành ngày theo lịch, không lệch múi giờ. */
function parseDay(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Số tuần ISO-8601 của một ngày ('2026-11-16' → 47); sai định dạng thì null. */
export function isoWeek(iso: string | null | undefined): number | null {
  const d = parseDay(iso)
  if (!d) return null
  const day = d.getUTCDay() || 7 // Chủ nhật = 7
  const thursday = new Date(d.getTime() + (4 - day) * 86_400_000)
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

/** 'YYYY-MM-DD' → 'dd/MM'; sai định dạng thì trả nguyên chuỗi (hoặc '' khi rỗng). */
export function dayMonth(iso: string | null | undefined): string {
  const d = parseDay(iso)
  if (!d) return iso ?? ''
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Nhãn cho điểm hoàn thành 1–5 của bài nói tuần. */
export function weeklyScoreLabel(score: number | null | undefined): { label: string; tone: 'success' | 'accent' | 'danger' } | null {
  if (score == null || !Number.isFinite(score)) return null
  if (score >= 5) return { label: 'Rất tốt', tone: 'success' }
  if (score >= 4) return { label: 'Tốt', tone: 'success' }
  if (score >= 3) return { label: 'Khá', tone: 'accent' }
  return { label: 'Cần luyện thêm', tone: 'danger' }
}

/** Tốc độ nói tham chiếu cho thanh "Từ / phút": người bản xứ nói chậm rãi ~130–150 từ/phút. */
export const WPM_REFERENCE = 150

export function wpmRatio(wpm: number | null | undefined): number {
  if (wpm == null || !Number.isFinite(wpm) || wpm <= 0) return 0
  return Math.min(1, wpm / WPM_REFERENCE)
}

/** Tiêu đề phiếu luyện nói (mẫu `speakreport`): chữ có vệt vàng theo điểm /10, phần sau là lời nhận xét. */
export function conversationHeadline(score: number | null | undefined): { mark: string; after: string } {
  if (score == null || !Number.isFinite(score)) return { mark: 'Xong', after: 'buổi luyện nói' }
  if (score >= 8) return { mark: 'Rất tốt', after: 'nói tự nhiên' }
  if (score >= 6) return { mark: 'Đạt', after: 'nói khá trôi chảy' }
  if (score >= 4) return { mark: 'Gần đạt', after: 'cần luyện thêm' }
  return { mark: 'Cần luyện', after: 'thêm vài buổi' }
}
