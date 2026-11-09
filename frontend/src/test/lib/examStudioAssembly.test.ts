/** Xưởng đề đợt 2 — ghép bộ đề: lọc ô thay được, dựng danh sách thay, kiểm form, trạng thái, gợi ý tên. */
import { describe, it, expect } from 'vitest'
import type { AssemblyBase, AssemblySlotBlocks } from '@/lib/adminExamStudioApi'
import {
  assembledStatus, assemblyFormErrors, assemblyReplacements, assemblyRows, nextAssemblyNumber, slotKey,
} from '@/lib/examStudioLogic'

const counts = { EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }
const block = (id: number) => ({ id, titleDe: `T${id}`, theme: null, difficultyCounts: counts, exposureCount: 0 })

const base: AssemblyBase = {
  id: 7, title: 'telc B1 Modelltest 1', reviewed: true,
  slots: [
    { section: 'LESEN', teil: 1, type: 'HEADLINES' },
    { section: 'LESEN', teil: 2, type: 'ARTICLE_MC' },
    { section: 'LESEN', teil: 3, type: 'ADS' },
    { section: 'HOEREN', teil: 1, type: null },
  ],
}

const slots: AssemblySlotBlocks[] = [
  { section: 'LESEN', teil: 2, type: 'ARTICLE_MC', blocks: [block(12), block(13)] },
  { section: 'LESEN', teil: 3, type: 'ARTICLE_MC', blocks: [block(20)] }, // khác dạng → khoá
  { section: 'LESEN', teil: 1, type: 'HEADLINES', blocks: [] }, // kho trống → bỏ
  { section: 'LESEN', teil: 5, type: 'RULES', blocks: [block(30)] }, // đề nền không có ô → bỏ
  { section: 'hoeren', teil: 1, type: 'TRUE_FALSE', blocks: [block(40)] }, // đề nền không ghi type → cho
]

describe('assemblyRows', () => {
  it('chỉ giữ ô kho có Teil và đề nền có cùng section+teil; khác type thì khoá', () => {
    const rows = assemblyRows(base, slots)
    expect(rows.map((r) => [slotKey(r.slot.section, r.slot.teil), r.status])).toEqual([
      ['HOEREN#1', 'OK'],
      ['LESEN#2', 'OK'],
      ['LESEN#3', 'TYPE_MISMATCH'],
    ])
    expect(assemblyRows(null, slots)).toEqual([])
  })
})

describe('assemblyReplacements', () => {
  const rows = assemblyRows(base, slots)
  it('bỏ ô "giữ đề nền", ô bị khoá và blockId không thuộc ô', () => {
    expect(assemblyReplacements(rows, {
      'LESEN#2': 13,
      'LESEN#3': 20, // khoá
      'HOEREN#1': null,
    })).toEqual([{ section: 'LESEN', teil: 2, blockId: 13 }])
    expect(assemblyReplacements(rows, { 'LESEN#2': 99 })).toEqual([])
  })
})

describe('assemblyFormErrors', () => {
  it('cần đề nền, tên và ≥ 1 Teil thay', () => {
    expect(assemblyFormErrors({ baseExamId: 7, title: 'X', replacements: [{}] })).toEqual([])
    expect(assemblyFormErrors({ baseExamId: null, title: '  ', replacements: [] }))
      .toEqual(['NO_BASE', 'NO_TITLE', 'NO_REPLACEMENT'])
  })
})

describe('assembledStatus + nextAssemblyNumber', () => {
  it('Sắp có / Đã phát hành / Đã gỡ', () => {
    expect(assembledStatus({ reviewed: false, active: true })).toBe('UPCOMING')
    expect(assembledStatus({ reviewed: true, active: true })).toBe('PUBLISHED')
    expect(assembledStatus({ reviewed: true, active: false })).toBe('RETIRED')
  })
  it('số gợi ý lớn hơn số cuối tên đã dùng và số bộ hiện có', () => {
    expect(nextAssemblyNumber([])).toBe(1)
    expect(nextAssemblyNumber([{ title: 'Bộ đề ghép 4' }, { title: 'Khác' }])).toBe(5)
    expect(nextAssemblyNumber([{ title: 'a' }, { title: 'b' }])).toBe(3)
  })
})
