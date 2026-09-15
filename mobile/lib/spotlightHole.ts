// Hình học thuần cho spotlight tour — tách khỏi SpotlightTour.tsx để test được.
//
// Lớp mờ = MỘT path SVG phủ cả màn, khoét lỗ bo tròn bằng luật even-odd
// (`spotlightHolePath`). Lịch sử: bản đầu vẽ lớp mờ bằng mẹo "viền khổng lồ"
// borderWidth 2000 (không hiện trên New Architecture của build public 17);
// bản #529/#544 dùng 4 tấm mờ + 4 miếng vá góc (View, overflow hidden) — miếng
// vá hiện trên simulator nhưng KHÔNG hiện trên máy thật của owner (06/09/2026),
// nên khung vàng bo tròn mà vùng sáng vẫn vuông. Path SVG khoét lỗ là một hình
// duy nhất: góc bo tròn nằm trong chính hình, không phụ thuộc cách compositor
// xếp lớp. `d` được tính mỗi frame trong worklet (useAnimatedProps).

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
 * Bốn vùng bao quanh ô khoét `cutout` (toạ độ window, đã gồm pad), thứ tự
 * trên · dưới · trái · phải — dùng cho lớp CHẶN CHẠM ở bước tap-through (chỉ
 * phần tử được chiếu sáng nhận được chạm). Vùng trái/phải chỉ cao bằng ô khoét
 * nên bốn vùng không chồng nhau; ô khoét tràn ra ngoài màn thì vùng tương ứng
 * co về 0, không bao giờ âm.
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
 * Path SVG cho lớp mờ: hình chữ nhật phủ cả màn `winW × winH` trừ đi ô khoét
 * bo tròn bán kính `radius` (vẽ với `fillRule="evenodd"` → phần chồng của hai
 * subpath thành lỗ trong suốt). Bán kính tự kẹp về ≤ nửa cạnh ngắn để ô nhỏ
 * không vẽ cung lệch; ô khoét rỗng (cạnh ≤ 0) → chỉ còn tấm mờ phẳng. Số được
 * làm tròn 2 chữ số thập phân để chuỗi ngắn, ổn định giữa các frame.
 */
export function spotlightHolePath(winW: number, winH: number, cutout: ScrimRect, radius: number): string {
  'worklet'
  const f = (n: number) => Math.round(n * 100) / 100
  const outer = `M0 0H${f(Math.max(0, winW))}V${f(Math.max(0, winH))}H0Z`
  const w = cutout.width
  const h = cutout.height
  if (!(w > 0) || !(h > 0)) return outer
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const x = cutout.x
  const y = cutout.y
  const arc = `A${f(r)} ${f(r)} 0 0 1 `
  const hole =
    `M${f(x + r)} ${f(y)}H${f(x + w - r)}${arc}${f(x + w)} ${f(y + r)}V${f(y + h - r)}${arc}${f(x + w - r)} ${f(y + h)}` +
    `H${f(x + r)}${arc}${f(x)} ${f(y + h - r)}V${f(y + r)}${arc}${f(x + r)} ${f(y)}Z`
  return outer + hole
}
