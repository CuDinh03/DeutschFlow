/**
 * Mọi màu phần thi phải trỏ vào một token CÓ THẬT trong `galerie.css`.
 *
 * Bẫy: `var(--ga-pink)` không tồn tại vẫn biên dịch được, `tsc` im lặng, test giao diện cũng im
 * lặng — dải trên của phần đó chỉ đơn giản là mất màu trên máy học viên. Cổng này bắt đúng ca đó
 * (gặp thật khi thêm SPRACHBAUSTEINE cho đề telc, 15/09/2026).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { SECTION_COLOR } from '@/app/v2/student/mock-exam/run/ExamTaking'

const css = readFileSync(join(process.cwd(), 'src/styles/galerie.css'), 'utf8')

describe('màu của từng phần thi', () => {
  it('mỗi phần trỏ vào một token galerie có thật', () => {
    const thieu: string[] = []
    for (const [section, value] of Object.entries(SECTION_COLOR)) {
      const token = /var\((--[a-z0-9-]+)\)/.exec(value)?.[1]
      expect(token, `${section} phải dùng token galerie, không phải màu rời: ${value}`).toBeTruthy()
      if (!new RegExp(`${token}\\s*:`).test(css)) thieu.push(`${section} → ${token}`)
    }
    expect(thieu, 'token không có trong galerie.css').toEqual([])
  })

  it('phủ đủ năm phần của cả hai định dạng đề', () => {
    expect(Object.keys(SECTION_COLOR).sort()).toEqual(
      ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRACHBAUSTEINE', 'SPRECHEN'].sort(),
    )
  })

  it('mỗi phần một màu khác nhau — hai phần trùng màu là mất tín hiệu điều hướng', () => {
    const values = Object.values(SECTION_COLOR)
    expect(new Set(values).size).toBe(values.length)
  })
})
