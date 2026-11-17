/**
 * Câu dùng thử trên trang công khai (owner chốt 18/11/2026): chỉ dùng câu trung tính "Dùng thử 7 ngày,
 * không cần thanh toán trước" (en "7-day free trial", de "7 Tage kostenlos testen"). Không nêu "Pro" trong
 * câu dùng thử cho tới khi gói dùng thử theo lượt (quyết định 11/11) chạy thật — nếu không trang công khai
 * sẽ mô tả lệch sản phẩm. Quét catalog vi/en/de và mã trang công khai.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const TRIAL_PRO = /7[- ](ngày|days?|tagen?)\b[^."]{0,25}\bpro\b|\bpro[- ]trial\b|\bpro\b[^."]{0,10}7[- ](ngày|days?|tagen?)\b/i

const CATALOGS = ['landing', 'auth'].flatMap((ns) =>
  ['vi', 'en', 'de'].map((l) => join(ROOT, 'messages', 'v2', `${ns}.${l}.json`)),
)
const SOURCE_DIRS = [
  'src/data',
  'src/app/cam-nang',
  'src/app/chi-phi',
  'src/app/luyen-thi',
  'src/app/mydeutschflow-la-gi',
  'src/app/free-grade',
  'src/app/report',
  'src/app/phong-van',
  'src/components/landing-v2',
].map((d) => join(ROOT, d))

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return listFiles(p)
    return /\.(tsx?|json)$/.test(name) && !/\.test\./.test(name) ? [p] : []
  })
}

function offendingLines(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => TRIAL_PRO.test(line))
    .map((line) => `${file.replace(ROOT, '')}: ${line.trim().slice(0, 120)}`)
}

describe('câu dùng thử trên trang công khai', () => {
  it('mẫu bắt được các dạng cũ vi/en/de', () => {
    for (const s of ['7 ngày Pro', 'có 7 ngày Pro khi', '7 days of Pro', '7-day free Pro trial', 'mit 7 Tagen Pro', '7 Tage Pro gratis']) {
      expect(TRIAL_PRO.test(s), s).toBe(true)
    }
    for (const s of ['Dùng thử 7 ngày, không cần thanh toán trước', '7-day free trial', '7 Tage kostenlos testen', 'cần gói Pro']) {
      expect(TRIAL_PRO.test(s), s).toBe(false)
    }
  })

  it('catalog và trang công khai không còn câu "7 ngày Pro"', () => {
    const files = CATALOGS.concat(SOURCE_DIRS.flatMap(listFiles), [join(ROOT, 'src/lib/llmsTxt.ts')])
    expect(files.flatMap(offendingLines)).toEqual([])
  })
})
