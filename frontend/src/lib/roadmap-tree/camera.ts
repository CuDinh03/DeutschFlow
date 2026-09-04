/**
 * Toán camera của cây học tập — tách khỏi component để test được bằng số.
 *
 * Quy ước: camera là transform `translate(x y) scale(scale)` áp lên nội dung SVG,
 * nên một điểm nội dung p hiện ra tại `p * scale + (x, y)` trong hệ toạ độ viewBox.
 * Mọi hàm trả camera MỚI (không mutate).
 */

export interface Camera {
  scale: number
  x: number
  y: number
}

export const CAMERA_IDLE: Camera = { scale: 1, x: 0, y: 0 }
export const MIN_SCALE = 0.55
export const MAX_SCALE = 2.4

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Phóng/thu quanh một điểm neo (toạ độ viewBox) — điểm neo đứng yên trên màn hình.
 * Đây chính là phép "zoom dưới con trỏ" của con lăn và "zoom quanh trung điểm" của pinch.
 */
export function zoomAtPoint(cam: Camera, factor: number, anchorX: number, anchorY: number): Camera {
  const scale = clampScale(cam.scale * factor)
  const ratio = scale / cam.scale
  return { scale, x: anchorX - (anchorX - cam.x) * ratio, y: anchorY - (anchorY - cam.y) * ratio }
}

/** Tịnh tiến camera theo delta toạ độ viewBox (pan). */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x + dx, y: cam.y + dy }
}

/**
 * Camera đưa điểm nội dung (nodeX, nodeY) về TÂM viewBox với scale cho trước.
 * Suy từ quy ước trên: tâm = node*scale + (x,y) ⇒ (x,y) = tâm − node*scale.
 */
export function focusCamera(
  nodeX: number,
  nodeY: number,
  viewWidth: number,
  viewHeight: number,
  scale: number,
): Camera {
  const s = clampScale(scale)
  return { scale: s, x: viewWidth / 2 - nodeX * s, y: viewHeight / 2 - nodeY * s }
}

/**
 * Chọn scale để node hiện ~`targetScreenRadius`px trên màn hình.
 *
 * SVG dùng `preserveAspectRatio="xMidYMid meet"` nên 1 đơn vị viewBox = `meetScale`px màn hình,
 * với meetScale = min(frameW/viewW, frameH/viewH). Bán kính vùng bấm của node là
 * `nodeRadius` đơn vị viewBox ⇒ scale cần = target / (nodeRadius * meetScale).
 * Cây càng dài (meetScale càng bé) scale bù càng lớn — nhưng vẫn kẹp trong [1, MAX_SCALE]:
 * không bao giờ thu NHỎ hơn mức fit chỉ vì node đã đủ to.
 */
export function focusScaleFor(
  frameWidth: number,
  frameHeight: number,
  viewWidth: number,
  viewHeight: number,
  nodeRadius: number,
  targetScreenRadius: number,
): number {
  if (frameWidth <= 0 || frameHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) return 1
  const meetScale = Math.min(frameWidth / viewWidth, frameHeight / viewHeight)
  if (meetScale <= 0) return 1
  const wanted = targetScreenRadius / (nodeRadius * meetScale)
  return clampScale(Math.max(1, wanted))
}
