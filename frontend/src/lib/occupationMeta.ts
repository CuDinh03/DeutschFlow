/**
 * Độ dài tiêu đề và mô tả của trang nghề `/phong-van/[nghe]/` (rà câu chữ 14/11/2026). Google cắt tiêu đề
 * quanh 60 ký tự và mô tả quanh 160 ký tự; tên nghề lấy từ danh mục backend nên có tên rất dài
 * ("Anlagenmechaniker/in für Sanitär-, Heizungs- und Klimatechnik", 61 ký tự).
 * Module thuần để test được.
 */
export const MAX_TITLE = 60
export const MAX_DESCRIPTION = 160

/**
 * Chọn bản đầu tiên vừa giới hạn (các bản xếp từ đầy đủ tới tối giản). Không bản nào vừa thì cắt bản
 * cuối ở ranh giới từ và thêm "…" — chỉ xảy ra với tên nghề dài hơn chính giới hạn.
 */
export function fitText(candidates: readonly string[], max: number): string {
  const fit = candidates.find((c) => c.length <= max)
  if (fit !== undefined) return fit
  const last = candidates[candidates.length - 1] ?? ''
  const cut = last.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '')}…`
}
