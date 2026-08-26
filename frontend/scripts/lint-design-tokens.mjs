#!/usr/bin/env node
/**
 * Design-token lint — baseline/ratchet theo FINGERPRINT (Wave 0, W0-C1 + Gate 0 review).
 *
 * Repo còn rất nhiều literal/arbitrary value cũ, nên rule KHÔNG được đánh trượt toàn bộ debt.
 * Baseline (`design-token-baseline.json`) ghi debt hiện trạng theo IDENTITY:
 *     { "<file>": { "<rule>": { "<normalized matched content>": <số lần xuất hiện> } } }
 * — không phải tổng đếm. Nhờ vậy XÓA violation A rồi THÊM violation B trong cùng file vẫn FAIL
 * (B không có trong baseline), và violation trong FILE MỚI luôn fail (file mới baseline = 0).
 *
 * Quy tắc ratchet:
 *   • Fail khi (file, rule, match) vượt số lần trong baseline — kể cả match mới toanh.
 *   • Baseline chỉ được GIẢM. `--update-baseline` từ chối ghi thêm identity/số lần mới trừ khi
 *     chạy với APPROVE_BASELINE_INCREASE=1 (cần approval của owner).
 *   • Exception registry (`design-token-exceptions.json`): [{file, rule, pattern, reason}] —
 *     match theo FILE CHÍNH XÁC (===, không startsWith), pattern là chuỗi con của dòng, reason
 *     bắt buộc không rỗng.
 *   • Escape hatch tại chỗ: `design-token-allow: <lý do>` trên dòng — CHỈ hợp lệ khi có lý do
 *     không rỗng sau dấu hai chấm; `design-token-allow` trần không có tác dụng.
 *
 * CI và developer local chạy CÙNG một lệnh: `npm run check:design-tokens`.
 * Phạm vi: chỉ surface Galerie canonical (/v2) — legacy bị đóng băng, không lint.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'design-token-baseline.json')
const EXCEPTIONS_PATH = join(ROOT, 'design-token-exceptions.json')

/** Surface canonical được lint. Legacy (src/app ngoài /v2, components/ui, globals.css) KHÔNG lint. */
const SCAN_DIRS = ['src/app/v2', 'src/components/ui-v2', 'src/components/landing-v2']
const SCAN_EXT = new Set(['.tsx', '.ts', '.css'])

/** Rule → regex GLOBAL bắt từng match trên một dòng (dùng matchAll để lấy identity). */
export const RULES = {
  // Hex màu literal (trong className/style/const) — màu phải đi qua token --ga-*.
  'hex-literal': /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  // Cỡ chữ arbitrary — thay bằng thang text-ga-* (DS §3.1).
  'arbitrary-font-size': /\btext-\[\d+(?:\.\d+)?px\]/g,
  // Radius arbitrary — chỉ còn rounded-ga | rounded-ga-touch | rounded-ga-pill.
  'arbitrary-radius': /\brounded-\[[^\]]+\]/g,
  // Shadow arbitrary — chỉ còn shadow token ga.
  'arbitrary-shadow': /\bshadow-\[[^\]]+\]/g,
  // Shadow mặc định Tailwind trong surface ga (elevation phải qua token); bắt cả prefix hover:/focus:.
  'tailwind-default-shadow': /(?:^|[\s'"`:])(shadow-(?:sm|md|lg|xl|2xl))\b/g,
}

/** Escape hatch hợp lệ = có lý do KHÔNG RỖNG sau dấu hai chấm. */
const ALLOW_RE = /design-token-allow:\s*\S+/

function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    const rel = join(dir, name)
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) walk(rel, out)
    else if (SCAN_EXT.has(name.slice(name.lastIndexOf('.')))) out.push(rel)
  }
  return out
}

/**
 * Quét nội dung một file → { rule: { normalizedMatch: [{line, text}] } }.
 * `exceptions` đã được lọc theo file CHÍNH XÁC trước khi gọi. Export cho unit test.
 */
export function scanSource(text, exceptions = []) {
  const hits = {}
  const lines = text.split('\n')
  for (const [rule, re] of Object.entries(RULES)) {
    const ex = exceptions.filter(
      (e) => e.rule === rule && typeof e.reason === 'string' && e.reason.trim() !== '',
    )
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (ALLOW_RE.test(line)) continue // escape hatch CÓ lý do — bỏ qua dòng
      for (const m of line.matchAll(re)) {
        const match = (m[1] ?? m[0]).trim() // identity = nội dung match đã chuẩn hóa
        if (ex.some((e) => line.includes(e.pattern))) continue
        const byMatch = (hits[rule] ??= {})
        ;(byMatch[match] ??= []).push({ line: i + 1, text: line.trim().slice(0, 160) })
      }
    }
  }
  return hits
}

/** hits (per-match arrays) → fingerprint counts { rule: { match: count } }. Export cho test. */
export function toFingerprint(hits) {
  const fp = {}
  for (const [rule, byMatch] of Object.entries(hits)) {
    fp[rule] = {}
    for (const [match, arr] of Object.entries(byMatch)) fp[rule][match] = arr.length
  }
  return fp
}

/**
 * So sánh fingerprint hiện tại với baseline của MỘT file → danh sách violation mới.
 * Export cho regression test (thay A bằng B phải fail, file mới phải fail).
 */
export function diffAgainstBaseline(currentFp, baselineFp = {}) {
  const violations = []
  for (const [rule, byMatch] of Object.entries(currentFp)) {
    for (const [match, count] of Object.entries(byMatch)) {
      const allowed = baselineFp?.[rule]?.[match] ?? 0
      if (count > allowed) violations.push({ rule, match, count, allowed })
    }
  }
  return violations
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function validateExceptions(all) {
  const bad = all.filter(
    (e) => !e.file || !e.rule || !e.pattern || typeof e.reason !== 'string' || e.reason.trim() === '',
  )
  if (bad.length) {
    console.error('✖ design-token-exceptions.json có entry thiếu file/rule/pattern/reason:')
    for (const e of bad) console.error('   ' + JSON.stringify(e))
    process.exit(1)
  }
}

function main() {
  const update = process.argv.includes('--update-baseline')
  const baseline = loadJson(BASELINE_PATH, {})
  const allExceptions = loadJson(EXCEPTIONS_PATH, [])
  validateExceptions(allExceptions)

  const files = SCAN_DIRS.flatMap((d) => walk(d))
  const current = {}
  const details = {}
  for (const rel of files) {
    const posix = rel.split('\\').join('/')
    // Exception match theo FILE CHÍNH XÁC — không startsWith (Gate 0 review).
    const ex = allExceptions.filter((e) => e.file === posix)
    const hits = scanSource(readFileSync(join(ROOT, rel), 'utf8'), ex)
    const fp = toFingerprint(hits)
    if (Object.keys(fp).length) {
      current[posix] = fp
      details[posix] = hits
    }
  }

  const totalOf = (tree) =>
    Object.values(tree).reduce(
      (s, rules) => s + Object.values(rules).reduce((a, m) => a + Object.values(m).reduce((x, n) => x + n, 0), 0),
      0,
    )

  if (update) {
    // Ratchet khi ghi baseline: mọi identity mới hoặc số lần tăng đều bị từ chối trừ khi
    // owner approve tường minh (không auto-generate exception/debt mới — W0-C1).
    const increased = []
    if (existsSync(BASELINE_PATH)) {
      for (const [file, fp] of Object.entries(current)) {
        for (const v of diffAgainstBaseline(fp, baseline[file])) {
          increased.push(`${file} · ${v.rule} · "${v.match}": ${v.allowed} → ${v.count}`)
        }
      }
    }
    if (increased.length && process.env.APPROVE_BASELINE_INCREASE !== '1') {
      console.error('✖ Từ chối NÂNG baseline (chỉ được giảm). Cần owner approve rồi chạy lại với APPROVE_BASELINE_INCREASE=1:')
      for (const line of increased) console.error('   ' + line)
      process.exit(1)
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
    console.log(`✓ Baseline (fingerprint) ghi lại: ${Object.keys(current).length} file, ${totalOf(current)} violation hiện trạng.`)
    return
  }

  let newViolations = 0
  for (const [file, fp] of Object.entries(current)) {
    const vs = diffAgainstBaseline(fp, baseline[file])
    for (const v of vs) {
      newViolations += v.count - v.allowed
      console.error(`✖ ${file} — ${v.rule} · "${v.match}": ${v.count} > baseline ${v.allowed} (+${v.count - v.allowed} MỚI)`)
      for (const h of (details[file]?.[v.rule]?.[v.match] ?? []).slice(0, 5)) {
        console.error(`     :${h.line}  ${h.text}`)
      }
    }
  }

  // Debt giảm ở đâu thì nhắc chốt baseline thấp hơn.
  let shrink = 0
  for (const [file, rules] of Object.entries(baseline)) {
    for (const [rule, byMatch] of Object.entries(rules)) {
      for (const [match, allowed] of Object.entries(byMatch)) {
        const now = current[file]?.[rule]?.[match] ?? 0
        if (now < allowed) shrink += allowed - now
      }
    }
  }
  if (shrink > 0) console.log(`ℹ Debt đã giảm ${shrink} violation so với baseline — chạy \`--update-baseline\` để chốt mức thấp hơn.`)

  if (newViolations > 0) {
    console.error(`\n✖ ${newViolations} violation MỚI so với baseline. Dùng token --ga-*/thang text-ga-*; ngoại lệ phải vào design-token-exceptions.json (đúng file, kèm lý do) hoặc \`design-token-allow: <lý do>\` tại chỗ — cả hai đều cần approve.`)
    process.exit(1)
  }
  console.log(`✓ design-token lint (fingerprint): 0 violation mới (debt hiện trạng: ${totalOf(current)}, chỉ được giảm).`)
}

// Chỉ chạy CLI khi được gọi trực tiếp (import trong unit test thì không).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
