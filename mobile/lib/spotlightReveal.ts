// Hình học thuần cho việc CUỘN neo vào tầm nhìn trước khi spotlight chiếu sáng.
//
// Trước 05/09, bước tour có neo nằm dưới màn (vd thẻ "Ôn tập hôm nay" của tour
// SRS bị lấp dưới thanh tab) rơi về "màn mờ phẳng + tooltip giữa màn" — người
// dùng không biết bấm vào đâu (owner báo khi QA đợt 0). Nay host tour đo neo,
// hỏi ScrollView chứa neo cuộn tới đâu (hàm này), cuộn rồi đo lại mới khoét.
// Tách khỏi SpotlightTour.tsx để test được không cần render.

/** Dải dọc (toạ độ window) mà ô khoét phải nằm gọn: dưới safe-area, trên thanh tab nổi. */
export interface RevealBand {
  top: number
  bottom: number
}

export interface RevealInput {
  /** Ô khoét (đã gồm pad), toạ độ window — chỉ cần trục dọc. */
  cutout: { y: number; height: number }
  band: RevealBand
  /** Lề thở tối thiểu bên trong dải; ô lọt vào vùng lề vẫn coi là chưa gọn. */
  margin?: number
}

/**
 * Cuộn thêm bao nhiêu điểm (dương = nội dung chạy lên) để ô khoét nằm gọn trong
 * dải. 0 = đã gọn, không đụng vào ScrollView. Khi phải cuộn thì đưa TÂM ô về
 * giữa dải — chừa chỗ cho tooltip phía trên/dưới thay vì để ô sát mép; ô cao
 * hơn cả dải cũng canh giữa (không có cách nào gọn hơn).
 */
export function revealScrollDelta({ cutout, band, margin = 0 }: RevealInput): number {
  const top = band.top + margin
  const bottom = band.bottom - margin
  const cutoutBottom = cutout.y + cutout.height
  if (cutout.y >= top && cutoutBottom <= bottom) return 0
  const bandCenter = (top + bottom) / 2
  return cutout.y + cutout.height / 2 - bandCenter
}

/**
 * Offset tuyệt đối để gọi `scrollTo({ y })`, hoặc null khi không cần/không thể
 * cuộn. Offset hiện tại suy từ hai phép đo window: mép trên ScrollView
 * (`viewportTop`) trừ mép trên khung nội dung bên trong (`innerTop`) — khung
 * nội dung trượt theo cuộn nên hiệu này chính là contentOffset.y, không cần
 * theo dõi onScroll. Không cuộn âm (kẹp về 0); native tự kẹp trần theo
 * contentSize nên phía dưới không cần biết chiều cao nội dung.
 */
export function revealScrollOffset(
  input: RevealInput & { viewportTop: number; innerTop: number },
): number | null {
  const delta = revealScrollDelta(input)
  if (delta === 0) return null
  const current = input.viewportTop - input.innerTop
  const next = Math.max(0, current + delta)
  return Math.abs(next - current) < 0.5 ? null : next
}
