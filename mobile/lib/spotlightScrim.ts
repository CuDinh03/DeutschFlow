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
