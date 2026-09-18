/**
 * Phép toán cho khung cắt ảnh đại diện — tách khỏi component để test được không cần DOM.
 *
 * Quy ước toạ độ: khung xem là hình vuông cạnh `viewport` (px CSS). Ảnh được đặt lên khung bằng
 * góc trên-trái `offset`, đã nhân tỉ lệ `scale`. Offset ÂM nghĩa là phần bên trái/bên trên của ảnh
 * bị đẩy ra ngoài khung — đúng chiều trực giác khi người dùng kéo ảnh sang trái.
 */

export interface CropState {
  /** Cạnh khung xem, px. */
  viewport: number
  naturalWidth: number
  naturalHeight: number
  /** 1 = ảnh vừa khít khung theo cạnh ngắn ("cover"). */
  zoom: number
  offsetX: number
  offsetY: number
}

/** Cạnh tối đa của ảnh gửi lên — 512 là quá đủ cho ô 36–72px, đừng phí băng thông và S3. */
export const AVATAR_EDGE_PX = 512
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/**
 * Tỉ lệ để cạnh NGẮN của ảnh vừa khít khung. Dùng cạnh ngắn (không phải cạnh dài) vì khung là
 * hình vuông: lấy cạnh dài sẽ để lại dải trống ở hai bên.
 */
export function baseScaleOf(viewport: number, naturalWidth: number, naturalHeight: number): number {
  const shortest = Math.min(naturalWidth, naturalHeight)
  if (shortest <= 0) return 1
  return viewport / shortest
}

export function scaleOf(state: CropState): number {
  return baseScaleOf(state.viewport, state.naturalWidth, state.naturalHeight) * state.zoom
}

/**
 * Giữ ảnh luôn phủ kín khung: không cho kéo tới mức lòi nền ra. Biên dưới là `viewport - kích
 * thước đã phóng` (mép phải/dưới chạm khung), biên trên là 0 (mép trái/trên chạm khung).
 */
export function clampOffset(state: CropState): { offsetX: number; offsetY: number } {
  const scale = scaleOf(state)
  const displayedWidth = state.naturalWidth * scale
  const displayedHeight = state.naturalHeight * scale
  const minX = Math.min(0, state.viewport - displayedWidth)
  const minY = Math.min(0, state.viewport - displayedHeight)
  return {
    offsetX: Math.min(0, Math.max(minX, state.offsetX)),
    offsetY: Math.min(0, Math.max(minY, state.offsetY)),
  }
}

/** Offset để ảnh nằm chính giữa khung — trạng thái khởi đầu khi vừa chọn ảnh. */
export function centeredOffset(state: Omit<CropState, 'offsetX' | 'offsetY'>): {
  offsetX: number
  offsetY: number
} {
  const scale = scaleOf({ ...state, offsetX: 0, offsetY: 0 })
  return {
    offsetX: (state.viewport - state.naturalWidth * scale) / 2,
    offsetY: (state.viewport - state.naturalHeight * scale) / 2,
  }
}

/**
 * Phóng to/thu nhỏ quanh TÂM KHUNG chứ không quanh góc ảnh — thu nhỏ quanh góc làm chủ thể trôi
 * khỏi khung và người dùng phải kéo lại sau mỗi nấc zoom.
 */
export function zoomAroundCenter(state: CropState, nextZoom: number): CropState {
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom))
  const prevScale = scaleOf(state)
  const nextScale = scaleOf({ ...state, zoom: clampedZoom })
  const ratio = nextScale / prevScale
  const center = state.viewport / 2
  const next: CropState = {
    ...state,
    zoom: clampedZoom,
    // Điểm ảnh đang nằm ở tâm khung phải ở nguyên tâm khung sau khi đổi tỉ lệ.
    offsetX: center - (center - state.offsetX) * ratio,
    offsetY: center - (center - state.offsetY) * ratio,
  }
  return { ...next, ...clampOffset(next) }
}

/**
 * Vùng cần cắt, tính bằng PIXEL GỐC của ảnh — đây là thứ truyền thẳng vào
 * `ctx.drawImage(img, sx, sy, size, size, …)`.
 */
export function sourceRectOf(state: CropState): { sx: number; sy: number; size: number } {
  const scale = scaleOf(state)
  const { offsetX, offsetY } = clampOffset(state)
  const size = state.viewport / scale
  return {
    // Làm tròn xuống 0 để một sai số dấu phẩy động nhỏ không thành sx âm (Safari vẽ ra viền trong).
    sx: Math.max(0, -offsetX / scale),
    sy: Math.max(0, -offsetY / scale),
    size: Math.min(size, state.naturalWidth, state.naturalHeight),
  }
}

/** Cạnh ảnh xuất ra: không phóng to quá ảnh gốc — phóng to chỉ làm file nặng mà không nét hơn. */
export function outputEdgeOf(sourceSize: number): number {
  return Math.max(1, Math.round(Math.min(AVATAR_EDGE_PX, sourceSize)))
}
