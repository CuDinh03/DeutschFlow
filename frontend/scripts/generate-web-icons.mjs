#!/usr/bin/env node
/**
 * Sinh icon PNG cho PWA manifest từ public/icon.svg (nguồn duy nhất của brand mark).
 *
 * Đợt A tốc độ trang chủ (26/10/2026) — sinh thêm hai file mà trình duyệt/iOS tự xin:
 *  - `favicon.ico` (16/32/48, PNG trong vỏ ICO): `/favicon.ico` từng 404 trên production.
 *  - `apple-touch-icon.png` 180×180: iOS không dùng SVG cho "Thêm vào màn hình chính" và tự bo
 *    góc, nên bản này nền giấy PHỦ KÍN (rx=0) — góc trong suốt sẽ bị iOS tô đen.
 *
 *   node scripts/generate-web-icons.mjs
 *
 * Chạy lại mỗi khi icon.svg đổi, nếu không PNG trong manifest sẽ lệch khỏi favicon.
 * Rasterize bằng chromium của Playwright vì repo không có sharp/librsvg/ImageMagick.
 *
 * Icon để `purpose: "any"` chứ KHÔNG phải "maskable": vùng an toàn của Android
 * adaptive icon là hình tròn đường kính 80%, mà góc chữ D nằm cách tâm ~50.7/100
 * đơn vị viewBox (> bán kính 40) nên khai maskable sẽ bị cắt mất nét.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public')
const SOURCE = resolve(PUBLIC_DIR, 'icon.svg')
const SIZES = [192, 512]
const FAVICON_SIZES = [16, 32, 48]
const APPLE_TOUCH_SIZE = 180

const svg = readFileSync(SOURCE, 'utf8')
// Bản cho iOS: bỏ bo góc của nền — iOS tự áp mặt nạ bo góc của nó.
const svgFullBleed = svg.replace('rx="22"', 'rx="0"')
if (svgFullBleed === svg) throw new Error('icon.svg không còn `rx="22"` trên nền — sửa lại bước bỏ bo góc cho apple-touch-icon')

const browser = await chromium.launch()

async function rasterize(source, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>
       html, body { margin: 0; padding: 0; background: transparent }
       svg { display: block; width: ${size}px; height: ${size}px }
     </style>
     ${source}`,
    { waitUntil: 'load' },
  )
  // omitBackground giữ 4 góc bo trong suốt thay vì bệt trắng.
  const png = await page.screenshot({ omitBackground: true })
  await page.close()
  return png
}

/** Đóng gói các PNG vào vỏ ICO (định dạng ICO cho phép mục PNG từ Windows Vista). */
function packIco(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt8(0, at + 2)
    header.writeUInt8(0, at + 3)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...entries.map((e) => e.png)])
}

function write(name, buf) {
  writeFileSync(resolve(PUBLIC_DIR, name), buf)
  console.log(`✓ ${name} (${buf.length} bytes)`)
}

try {
  for (const size of SIZES) write(`icon-${size}.png`, await rasterize(svg, size))
  write('apple-touch-icon.png', await rasterize(svgFullBleed, APPLE_TOUCH_SIZE))
  const favicons = []
  for (const size of FAVICON_SIZES) favicons.push({ size, png: await rasterize(svg, size) })
  write('favicon.ico', packIco(favicons))
} finally {
  await browser.close()
}
