// Cỡ ô biểu tượng của màn chờ động khớp ô trên màn chờ native.
// splash.png 1284×2778 có ô 288px ở giữa, hiện bằng resizeMode "cover" ⇒ ảnh phủ kín màn,
// tỉ lệ = max(rộng màn / 1284, cao màn / 2778).
const SPLASH_W = 1284
const SPLASH_H = 2778
const SPLASH_TILE_PX = 288

export function splashTileSize(screenW: number, screenH: number): number {
  const scale = Math.max(screenW / SPLASH_W, screenH / SPLASH_H)
  return Math.round(SPLASH_TILE_PX * scale)
}
