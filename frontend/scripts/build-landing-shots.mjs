#!/usr/bin/env node
/**
 * build-landing-shots.mjs — PNG thô của Playwright → WebP đã thu nhỏ, đặt vào `public/landing/`.
 *
 * Nguồn: `test-results/landing-shots/<locale>/<tên>.png` (sinh bởi
 * `tests/e2e/landing/__product-shots.spec.ts`, chụp ở 1440×900 với deviceScaleFactor 2 → 2880 px).
 * Đích:  `public/landing/<locale>/<tên>.webp`, bề ngang tối đa MAX_WIDTH.
 *
 * 2880 px là gấp đôi mọi khe ảnh trên landing (rộng nhất ~1120 px CSS), nên hạ về 1600 px vẫn dư
 * độ nét cho màn Retina mà nhẹ hơn ~8 lần. Không nội suy lên: ảnh nhỏ hơn MAX_WIDTH giữ nguyên.
 *
 * Cần `cwebp` (libwebp): `brew install webp`. Chạy: `node scripts/build-landing-shots.mjs`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FE = dirname(fileURLToPath(new URL('.', import.meta.url)))
const SRC_DIR = join(FE, 'test-results', 'landing-shots')
const OUT_DIR = join(FE, 'public', 'landing')

const MAX_WIDTH = 1600
const QUALITY = 82

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
} catch {
  fail('thiếu `cwebp` — cài bằng `brew install webp` rồi chạy lại.')
}

if (!existsSync(SRC_DIR)) {
  fail(`không thấy ${SRC_DIR}. Chạy trước:\n  npx playwright test tests/e2e/landing/__product-shots.spec.ts`)
}

let count = 0
for (const locale of readdirSync(SRC_DIR)) {
  const localeDir = join(SRC_DIR, locale)
  if (!statSync(localeDir).isDirectory()) continue

  const outLocaleDir = join(OUT_DIR, locale)
  mkdirSync(outLocaleDir, { recursive: true })

  for (const file of readdirSync(localeDir)) {
    if (!file.endsWith('.png')) continue
    const out = join(outLocaleDir, file.replace(/\.png$/, '.webp'))
    // `-resize <w> 0` giữ đúng tỉ lệ; cwebp bỏ qua khi ảnh đã hẹp hơn.
    execFileSync('cwebp', ['-quiet', '-q', String(QUALITY), '-resize', String(MAX_WIDTH), '0', join(localeDir, file), '-o', out])
    const kb = Math.round(statSync(out).size / 1024)
    console.log(`  ${locale}/${file.replace(/\.png$/, '.webp')} — ${kb} KB`)
    count += 1
  }
}

console.log(count > 0 ? `✓ ${count} ảnh → public/landing/` : '⚠ không có PNG nào để chuyển.')
