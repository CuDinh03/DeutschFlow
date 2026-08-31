import { describe, expect, it } from 'vitest'
import { pct } from './tcShared'

// pct() đo tiến độ GIÁO TRÌNH: bài bổ trợ (supplementary, PR-4) không vào mẫu số.
describe('pct', () => {
  it('rounds completed/total over the flat list', () => {
    expect(pct([{ completed: true }, { completed: false }, { completed: false }])).toBe(33)
  })

  it('returns 0 for an empty list', () => {
    expect(pct([])).toBe(0)
  })

  it('excludes supplementary lessons from both numerator and denominator', () => {
    expect(
      pct([
        { completed: true, supplementary: false },
        { completed: false, supplementary: false },
        { completed: true, supplementary: true }, // bài bổ trợ đã dạy — không được kéo % lên
      ]),
    ).toBe(50)
  })

  it('returns 0 when every lesson is supplementary', () => {
    expect(pct([{ completed: true, supplementary: true }])).toBe(0)
  })
})
