/**
 * Icon đợt B (09/11/2026): trang công khai đã chuyển sang Galerie phải nằm trong `.ga-scope` và không quay lại
 * bảng màu Tailwind cũ (slate/indigo/emerald/amber…). Lint token (`scripts/lint-design-tokens.mjs`) bắt hex và
 * cỡ chữ lạc; test này bắt phần lint đó không thấy: tên màu Tailwind mặc định.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { gradeTone } from '@/components/marketing/GradeScore'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/** Trang (file render khung) phải bọc `.ga-scope`. */
const PAGES = [
  'src/app/luyen-thi/page.tsx',
  'src/app/luyen-thi/[slug]/page.tsx',
  'src/app/free-grade/page.tsx',
  'src/app/report/[token]/page.tsx',
]

/** Mọi file của các trang đó, kể cả phần client và thành phần dùng chung. */
const FILES = [
  ...PAGES,
  'src/app/free-grade/client-page.tsx',
  'src/components/marketing/ShareButtons.tsx',
  'src/components/marketing/GradeScore.tsx',
]

const LEGACY_PALETTE =
  /\b(?:text|bg|border|from|via|to|ring|shadow|divide|decoration|fill|stroke)-(?:slate|gray|zinc|neutral|indigo|violet|purple|emerald|green|teal|cyan|sky|blue|amber|yellow|orange|red|rose)-\d{2,3}\b/

describe('Trang công khai Galerie (icon đợt B)', () => {
  it.each(PAGES)('%s bọc .ga-scope và nạp galerie.css', (rel) => {
    const src = read(rel)
    expect(src).toContain('ga-scope')
    expect(src).toContain("import '@/styles/galerie.css'")
  })

  it.each(FILES)('%s không dùng bảng màu Tailwind cũ, không hex', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(LEGACY_PALETTE)
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
  })

  it('mức điểm chấm thử: ≥80 xanh, ≥60 navy, còn lại cam', () => {
    expect(gradeTone(100)).toBe('green')
    expect(gradeTone(80)).toBe('green')
    expect(gradeTone(79)).toBe('navy')
    expect(gradeTone(60)).toBe('navy')
    expect(gradeTone(59)).toBe('orange')
    expect(gradeTone(0)).toBe('orange')
  })
})
