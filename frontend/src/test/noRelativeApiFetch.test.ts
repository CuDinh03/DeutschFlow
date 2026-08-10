import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Chốt chặn QA 09/08: fetch('/api/…') tương đối resolve vào origin frontend
 * (Amplify) chứ không phải api.mydeutschflow.com → 404 âm thầm rồi rơi xuống
 * fallback (đã xảy ra với TTS giọng persona trong useSpeech.ts). Mọi lời gọi
 * backend phải đi qua api client (lib/api.ts) — có baseURL, Authorization và
 * refresh token.
 */

// Nợ đã biết, có task riêng xử lý — không thêm mục mới vào danh sách này.
const ALLOWLIST = new Set<string>([])

const RELATIVE_API_FETCH = /fetch\(\s*["'`]\/api\//

/** Bỏ phần comment `//…` của từng dòng để không bắt nhầm code nhắc tới lỗi này trong chú thích. */
function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return collectSourceFiles(full)
    return /\.(ts|tsx)$/.test(name) ? [full] : []
  })
}

describe('không fetch /api/ bằng đường dẫn tương đối', () => {
  it('mọi lời gọi backend phải qua api client, không fetch("/api/…")', () => {
    const srcRoot = join(__dirname, '..')
    const offenders = collectSourceFiles(srcRoot)
      .map((file) => relative(join(srcRoot, '..'), file))
      .filter((rel) => !rel.startsWith('src/test/'))
      .filter((rel) => !ALLOWLIST.has(rel))
      .filter((rel) => RELATIVE_API_FETCH.test(stripLineComments(readFileSync(join(srcRoot, '..', rel), 'utf8'))))

    expect(offenders).toEqual([])
  })
})
