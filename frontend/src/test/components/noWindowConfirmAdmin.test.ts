/** Khu admin không dùng window.confirm — mọi xác nhận đi qua ConfirmDialog (AC-ADMIN-21). */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ADMIN_DIR = join(__dirname, '..', '..', 'app', 'v2', 'admin')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

describe('Khu admin — không còn window.confirm', () => {
  it('không file nào gọi window.confirm(', () => {
    const offenders = walk(ADMIN_DIR).filter((f) => /window\.confirm\s*\(/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
