// Band luyện tập theo TRÌNH ĐỘ HIỆN TẠI của người học — gương `SpeakingCefrSupport` phía backend
// (`floorPracticeBand`: A0 → A1, thiếu hồ sơ → A1) và `normCurrent` của web weekly-speaking.
//
// Trước 17/09/2026 app không đọc `currentLevel` ở đâu ngoài onboarding: màn Nói (CompanionSelect),
// Nói tuần, Thi thử và Thi nói đều mặc định **B1** ⇒ học viên tự khai A0 mở app là thấy hội thoại /
// đề B1 (owner báo 17/09). Backend KHÔNG kẹp lại lựa chọn của client cho phiên nói
// (`ChatPrepService.resolveSessionLevel` tôn trọng band client gửi) nên mặc định sai ở client là
// trải nghiệm sai thật, không phải chỉ nhãn sai.
//
// Thuần, không phụ thuộc React — test ở `__tests__/learnerBand.test.ts`.

export const CEFR_LADDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrBand = (typeof CEFR_LADDER)[number]

/** Band an toàn khi chưa biết gì về người học — khớp `SpeakingCefrSupport.DEFAULT_BAND`. */
export const DEFAULT_BAND: CefrBand = 'A1'

function ladderIndex(band: string | null | undefined): number {
  if (!band) return -1
  return CEFR_LADDER.indexOf(band.trim().toUpperCase() as CefrBand)
}

/**
 * Band luyện tập từ trình độ hiện tại của hồ sơ: `A0`, thiếu, hoặc giá trị lạ → A1; còn lại giữ
 * nguyên (chuẩn hoá chữ hoa). Không bao giờ trả về band CAO hơn trình độ khai.
 */
export function practiceBand(currentLevel: string | null | undefined): CefrBand {
  const i = ladderIndex(currentLevel)
  return i < 0 ? DEFAULT_BAND : CEFR_LADDER[i]
}

/**
 * Chọn band mặc định trong danh sách `available` (band đang có đề / blueprint / chip):
 * - đúng band luyện tập nếu có;
 * - không có thì band CAO NHẤT còn THẤP HƠN (không đẩy người học lên trên trình độ của họ);
 * - dưới cũng không có thì band thấp nhất trong danh sách;
 * - danh sách chỉ toàn nhãn lạ → phần tử đầu; rỗng hoặc chưa tải (`null`/`undefined`) → `null`
 *   để màn chờ thay vì nháy qua một band sai rồi mới đổi.
 * Trả về đúng chuỗi trong `available` (giữ nguyên cách viết của server).
 */
export function pickBand(
  currentLevel: string | null | undefined,
  available: readonly string[] | null | undefined,
): string | null {
  if (!available || available.length === 0) return null
  const want = ladderIndex(practiceBand(currentLevel))
  const ranked = available
    .map((band) => ({ band, i: ladderIndex(band) }))
    .filter((x) => x.i >= 0)
    .sort((x, y) => x.i - y.i)
  if (ranked.length === 0) return available[0] ?? null
  const exact = ranked.find((x) => x.i === want)
  if (exact) return exact.band
  const below = [...ranked].reverse().find((x) => x.i < want)
  return (below ?? ranked[0]).band
}
