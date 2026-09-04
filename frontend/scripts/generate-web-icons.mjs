#!/usr/bin/env node
/**
 * Sinh icon PNG cho PWA manifest từ public/icon.svg (nguồn duy nhất của brand mark).
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

const svg = readFileSync(SOURCE, 'utf8')
const browser = await chromium.launch()

try {
  for (const size of SIZES) {
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
       ${svg}`,
      { waitUntil: 'load' },
    )
    // omitBackground giữ 4 góc bo trong suốt thay vì bệt trắng.
    const png = await page.screenshot({ omitBackground: true })
    const out = resolve(PUBLIC_DIR, `icon-${size}.png`)
    writeFileSync(out, png)
    console.log(`✓ icon-${size}.png (${png.length} bytes)`)
    await page.close()
  }
} finally {
  await browser.close()
}
