/**
 * Phông trang trí của áp phích rao vặt (telc Lesen Teil 3; owner chốt 13/11/2026 "khuôn chữ, có thêm phông
 * trang trí"). Tự host bằng `next/font/local`: tệp `.woff2` nằm trong repo (`src/fonts/poster/`, kèm giấy phép
 * SIL OFL 1.1), bản build KHÔNG gọi Google. Chỉ tập ký tự Latin (đủ ä ö ü ß € – „ “), `display: swap`, không
 * preload: trình duyệt chỉ tải tệp nào có chữ đang hiển thị dùng tới, tức là chỉ khi mở một Teil rao vặt.
 *
 * Nguồn tệp: gói `@fontsource/*` 5.3.0 (không thêm vào dependencies). Tổng 94 852 byte:
 * Caveat 700 (51 020) · VT323 400 (17 936) · Abril Fatface 400 (13 156) · Oswald 600 (12 740).
 */
import localFont from 'next/font/local'

const hand = localFont({
  src: '../../../fonts/poster/caveat-latin-700-normal.woff2',
  weight: '700',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['Segoe Print', 'Bradley Hand', 'cursive'],
  variable: '--font-poster-hand',
})

const pixel = localFont({
  src: '../../../fonts/poster/vt323-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['Courier New', 'monospace'],
  variable: '--font-poster-pixel',
})

const display = localFont({
  src: '../../../fonts/poster/abril-fatface-latin-400-normal.woff2',
  weight: '400',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'serif'],
  variable: '--font-poster-display',
})

const condensed = localFont({
  src: '../../../fonts/poster/oswald-latin-600-normal.woff2',
  weight: '600',
  style: 'normal',
  display: 'swap',
  preload: false,
  fallback: ['Arial Narrow', 'Arial', 'sans-serif'],
  variable: '--font-poster-condensed',
})

/** Lớp gắn bốn biến `--font-poster-*` lên khối chứa các áp phích. */
export const posterFontVars = [hand.variable, pixel.variable, display.variable, condensed.variable].join(' ')
