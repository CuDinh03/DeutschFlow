#!/usr/bin/env node
/**
 * build-landing-shots.mjs — PNG thô của Playwright → WebP đã thu nhỏ, đặt vào `src/assets/landing/`.
 *
 * Nguồn: `test-results/landing-shots/<locale>/<tên>.png` (sinh bởi
 * `tests/e2e/landing/__product-shots.spec.ts`, chụp ở 1440×900 với deviceScaleFactor 2 → 2880 px).
 * Đích:  `src/assets/landing/<locale>/<tên>.webp`, bề ngang tối đa MAX_WIDTH.
 *
 * 2880 px là gấp đôi mọi khe ảnh trên landing (rộng nhất ~1120 px CSS), nên hạ về 1600 px vẫn dư
 * độ nét cho màn Retina mà nhẹ hơn ~8 lần. Không nội suy lên: ảnh nhỏ hơn MAX_WIDTH giữ nguyên.
 *
 * Cần `cwebp` (libwebp): `brew install webp`. Chạy: `node scripts/build-landing-shots.mjs`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readSync, closeSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FE = dirname(fileURLToPath(new URL('.', import.meta.url)))
const SRC_DIR = join(FE, 'test-results', 'landing-shots')
const OUT_DIR = join(FE, 'src', 'assets', 'landing')

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

/**
 * Bề ngang của PNG, đọc từ IHDR (4 byte big-endian tại offset 16 theo đặc tả PNG).
 *
 * Cần vì `cwebp -resize` CÓ nội suy PHÓNG TO khi ảnh nguồn hẹp hơn đích — nó không tự bỏ qua như
 * chú thích cũ ở đây tưởng. Chụp lại ở khổ nhỏ hơn mà cứ truyền -resize thì được một tấm 1600px
 * nhoè toẹt mà không có cảnh báo nào.
 */
function pngWidth(file) {
  const fd = openSync(file, 'r')
  try {
    const head = Buffer.alloc(24)
    readSync(fd, head, 0, 24, 0)
    if (head.toString('binary', 1, 4) !== 'PNG') return null
    return head.readUInt32BE(16)
  } finally {
    closeSync(fd)
  }
}

let count = 0
for (const locale of readdirSync(SRC_DIR)) {
  const localeDir = join(SRC_DIR, locale)
  if (!statSync(localeDir).isDirectory()) continue

  const outLocaleDir = join(OUT_DIR, locale)
  mkdirSync(outLocaleDir, { recursive: true })

  for (const file of readdirSync(localeDir)) {
    if (!file.endsWith('.png')) continue
    const src = join(localeDir, file)
    const out = join(outLocaleDir, file.replace(/\.png$/, '.webp'))
    const width = pngWidth(src)
    // `-resize <w> 0` giữ đúng tỉ lệ. Chỉ thu NHỎ: ảnh đã hẹp hơn MAX_WIDTH thì giữ nguyên,
    // không đưa -resize vào để cwebp khỏi nội suy phóng to.
    const resize = width != null && width <= MAX_WIDTH ? [] : ['-resize', String(MAX_WIDTH), '0']
    execFileSync('cwebp', ['-quiet', '-q', String(QUALITY), ...resize, src, '-o', out])
    const kb = Math.round(statSync(out).size / 1024)
    const note = resize.length === 0 ? ` (giữ nguyên ${width ?? '?'}px)` : ''
    console.log(`  ${locale}/${file.replace(/\.png$/, '.webp')} — ${kb} KB${note}`)
    count += 1
  }
}

console.log(count > 0 ? `✓ ${count} ảnh → src/assets/landing/` : '⚠ không có PNG nào để chuyển.')
