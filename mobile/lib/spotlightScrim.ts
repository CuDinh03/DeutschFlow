// Hình học thuần cho lớp mờ + lớp chặn chạm của spotlight tour — tách khỏi
// SpotlightTour.tsx để test được và để LỚP MỜ và LỚP CHẶN dùng chung một phép
// chia màn hình (trước đây lớp chặn đã chia 4 vùng đúng cách, còn lớp mờ vẽ
// bằng mẹo "viền khổng lồ" borderWidth 2000 — mẹo đó không hiện trên build
// New Architecture của bản public 17 nên tour chỉ có khung vàng, phần còn lại
// sáng nguyên; owner phát hiện khi QA đợt 0 ngày 05/09/2026).

export interface ScrimRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ScrimZone {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Bốn vùng bao quanh ô khoét sáng `cutout` (toạ độ window, đã gồm pad), theo
 * thứ tự trên · dưới · trái · phải. Vùng trái/phải chỉ cao bằng ô khoét, nên
 * bốn vùng không chồng nhau (lớp mờ có alpha, chồng là đậm gấp đôi). Ô khoét
 * tràn ra ngoài màn thì vùng tương ứng co về 0, không bao giờ âm.
 */
export function scrimZones(cutout: ScrimRect, winW: number, winH: number): ScrimZone[] {
  'worklet'
  const x = cutout.x
  const y = cutout.y
  const w = cutout.width
  const h = cutout.height
  return [
    { left: 0, top: 0, width: winW, height: Math.max(0, y) },
    { left: 0, top: y + h, width: winW, height: Math.max(0, winH - y - h) },
    { left: 0, top: y, width: Math.max(0, x), height: h },
    { left: x + w, top: y, width: Math.max(0, winW - x - w), height: h },
  ]
}

/**
 * Đặt một tấm mờ cỡ cố định `winW × winH` (neo ở góc 0,0) vào đúng vùng `z` bằng
 * transform thay vì `left/top/width/height`. Transform chạy trên compositor
 * (UI thread, không commit layout mỗi frame) — bản đầu (#529) animate thuộc tính
 * layout của 4 tấm nên trên máy thật owner thấy tour "giật, không mượt" (05/09).
 * Thứ tự transform: translate rồi scale quanh tâm → tâm tấm = tâm vùng, kích
 * thước = vùng. Vùng rỗng → scale 0 (ẩn), không bao giờ âm.
 */
export function scrimZoneTransform(z: ScrimZone, winW: number, winH: number) {
  'worklet'
  const w = Math.max(0, z.width)
  const h = Math.max(0, z.height)
  return {
    transform: [
      { translateX: z.left + w / 2 - winW / 2 },
      { translateY: z.top + h / 2 - winH / 2 },
      { scaleX: winW > 0 ? w / winW : 0 },
      { scaleY: winH > 0 ? h / winH : 0 },
    ],
  }
}

/**
 * Bốn miếng vá góc, thứ tự trên-trái · trên-phải · dưới-trái · dưới-phải: mỗi
 * miếng là ô `r × r` nằm TRONG ô khoét, đúng góc. Bốn tấm mờ ở trên để lại ô
 * khoét vuông góc trong khi khung vàng bo tròn bán kính `r` — owner nhìn thấy
 * "ô bo góc nhưng phần sáng lại vuông" (QA 05/09). Miếng vá phủ mờ phần góc
 * nằm ngoài cung tròn (xem `scrimCornerRingOffset`), cũng chỉ animate bằng
 * translate như 4 tấm mờ. Toạ độ = góc trên-trái của miếng (window).
 */
export function scrimCornerOffsets(cutout: ScrimRect, r: number): { x: number; y: number }[] {
  'worklet'
  const right = cutout.x + cutout.width - r
  const bottom = cutout.y + cutout.height - r
  return [
    { x: cutout.x, y: cutout.y },
    { x: right, y: cutout.y },
    { x: cutout.x, y: bottom },
    { x: right, y: bottom },
  ]
}

/**
 * Vị trí (left/top, toạ độ trong miếng vá `i`) của một vòng khuyên màu mờ cỡ
 * `4r × 4r` (borderRadius 2r, borderWidth r ⇒ lỗ bán kính r) sao cho tâm vòng
 * trùng góc TRONG của ô khoét: TL → (r, r), TR → (0, r), BL → (r, 0), BR → (0, 0).
 * Trong ô r×r, điểm cách tâm hơn r nằm trên vành (mờ), gần hơn r nằm trong lỗ
 * (sáng) — đúng hình "góc bo tròn ngược". Góc xa nhất cách tâm r·√2 < 2r nên
 * vành phủ kín, không hở; miếng vá `overflow: hidden` cắt phần vành thừa để
 * không chồng lên 4 tấm mờ. Không thể khoét lỗ tròn bằng View thường, còn mẹo
 * "viền khổng lồ" thì không hiện trên New Architecture (xem đầu file).
 */
export function scrimCornerRingOffset(i: number, r: number): { left: number; top: number } {
  const centerX = i % 2 === 0 ? r : 0
  const centerY = i < 2 ? r : 0
  return { left: centerX - 2 * r, top: centerY - 2 * r }
}
