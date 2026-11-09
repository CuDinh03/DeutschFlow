import { describe, expect, it } from 'vitest'
import { applyFilterPatch, defineFilters, parseFilters, serializeFilters } from './urlFilters'

const spec = defineFilters({
  q: { kind: 'string', default: '' },
  role: { kind: 'enum', values: ['all', 'STUDENT', 'MANAGER'] as const, default: 'all' },
  page: { kind: 'int', min: 1, max: 1000, default: 1 },
})

const qs = (s: string) => new URLSearchParams(s)

describe('urlFilters — bộ lọc trên URL', () => {
  it('đọc giá trị hợp lệ, thiếu thì lấy mặc định', () => {
    expect(parseFilters(spec, qs('role=MANAGER&page=3&q=lan'))).toEqual({ q: 'lan', role: 'MANAGER', page: 3 })
    expect(parseFilters(spec, qs(''))).toEqual({ q: '', role: 'all', page: 1 })
  })

  it('URL gõ tay sai không làm vỡ trang: enum lạ → mặc định, số → kẹp/mặc định', () => {
    expect(parseFilters(spec, qs('role=HACKER')).role).toBe('all')
    expect(parseFilters(spec, qs('page=0')).page).toBe(1)
    expect(parseFilters(spec, qs('page=99999')).page).toBe(1000)
    expect(parseFilters(spec, qs('page=abc')).page).toBe(1)
    expect(parseFilters(spec, qs('page=2.7')).page).toBe(2)
  })

  it('giá trị mặc định và chuỗi rỗng không ghi lên URL; tham số ngoài spec được giữ', () => {
    const out = serializeFilters(spec, { q: '', role: 'all', page: 2 }, qs('tab=plan&role=MANAGER'))
    expect(out.get('page')).toBe('2')
    expect(out.has('role')).toBe(false)
    expect(out.has('q')).toBe(false)
    expect(out.get('tab')).toBe('plan')
  })

  it('đổi bộ lọc khác page thì về trang 1; chỉ đổi page thì giữ', () => {
    const cur = { q: '', role: 'all', page: 5 }
    expect(applyFilterPatch(spec, cur, { role: 'MANAGER' })).toEqual({ q: '', role: 'MANAGER', page: 1 })
    expect(applyFilterPatch(spec, cur, { page: 6 })).toEqual({ q: '', role: 'all', page: 6 })
    expect(applyFilterPatch(spec, cur, { q: 'x', page: 3 })).toEqual({ q: 'x', role: 'all', page: 3 })
  })
})
