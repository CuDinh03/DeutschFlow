/** Xưởng đề đợt 4 — telc A2: danh mục theo cấp, rao vặt 8 mẩu / 1 x, richtig/falsch, form, ghép từ khung, content kho. */
import { describe, it, expect } from 'vitest'
import {
  LEVEL_SECTION_TEILS, adLettersFor, adRoles, adWordRange, adXExpected, blueprintRows, blueprintSelection, catalogEntry,
  firstItemNumber, hasDigits, isWritingKind, joinAccept, splitAccept, teilKind, trueFalseBalance,
} from '@/lib/examStudioLogic'
import { blockContentToPreview } from '@/components/admin/exam-studio/BlockPreviewModal'

describe('danh mục theo cấp', () => {
  it('A2: Lesen 1–3, Schreiben 1–2; Hören chưa có; B1 không lẫn', () => {
    expect(catalogEntry('LESEN', 1, 'A2')).toMatchObject({ teilType: 'MC_INFO', itemCount: 5, needsSources: false })
    expect(catalogEntry('LESEN', 2, 'A2')?.teilType).toBe('TRUE_FALSE')
    expect(catalogEntry('SCHREIBEN', 1, 'A2')).toMatchObject({ teilType: 'FILL_FORM', itemCount: 5 })
    expect(catalogEntry('SCHREIBEN', 2, 'A2')).toMatchObject({ teilType: 'WRITE_NOTE', itemCount: 0 })
    expect(catalogEntry('HOEREN', 1, 'A2')).toBeNull()
    expect(catalogEntry('LESEN', 1)?.teilType).toBe('MATCH_HEADLINE') // mặc định B1
    expect(LEVEL_SECTION_TEILS.A2.SPRACHBAUSTEINE).toBeUndefined()
  })
  it('dạng + số câu đầu', () => {
    expect(teilKind('FILL_FORM')).toBe('FILL_FORM')
    expect(isWritingKind('WRITE_NOTE')).toBe(true)
    expect(isWritingKind('FILL_FORM')).toBe(false)
    expect(firstItemNumber('TRUE_FALSE', 2)).toBe(6)
    expect(firstItemNumber('MC_INFO', 1)).toBe(1)
    expect(firstItemNumber('MATCH_AD_X', 3)).toBe(11)
  })
})

describe('Lesen 3 theo cấp', () => {
  it('A2: 8 mẩu a–h, 1 câu x, 10–35 từ; B1: 12 mẩu, 2 câu x', () => {
    expect(adLettersFor('A2')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    expect(adLettersFor('B1')).toHaveLength(12)
    expect(adXExpected('A2')).toBe(1)
    expect(adXExpected('B1')).toBe(2)
    expect(adWordRange('A2')).toEqual([10, 35])
    expect(adRoles({}, [], [], adLettersFor('A2'))).toHaveLength(8)
  })
})

describe('richtig/falsch + form', () => {
  it('đề thật 2–3 mỗi loại', () => {
    const it = (c: string) => ({ correct: c })
    expect(trueFalseBalance([it('richtig'), it('richtig'), it('falsch'), it('falsch'), it('richtig')])).toEqual({ richtig: 3, falsch: 2, balanced: true })
    expect(trueFalseBalance([it('richtig'), it('richtig'), it('richtig'), it('richtig'), it('falsch')]).balanced).toBe(false)
  })
  it('cách viết chấp nhận ⇄ meta.accept, ô có số', () => {
    expect(splitAccept(' Mo | Montag |')).toEqual(['Mo', 'Montag'])
    expect(joinAccept(['Mo', ' Montag ', ''])).toBe('Mo|Montag')
    expect(hasDigits('0316 4455')).toBe(true)
    expect(hasDigits('Graz')).toBe(false)
  })
})

describe('ghép từ khung', () => {
  const bp = { sections: [
    { slots: [{ section: 'LESEN', teil: 1, type: 'MULTIPLE_CHOICE' }, { section: 'LESEN', teil: 2, type: 'TRUE_FALSE' }] },
    { slots: [{ section: 'SCHREIBEN', teil: 1, type: 'FILL_FORM' }] },
  ] }
  const opt = (id: number, usedIn: { id: number; title: string }[] = []) =>
    ({ id, titleDe: null, theme: null, difficultyCounts: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }, exposureCount: 0, usedIn })
  const rows = blueprintRows(bp, [
    { section: 'LESEN', teil: 1, type: 'MULTIPLE_CHOICE', blocks: [opt(1)] },
    { section: 'lesen', teil: 2, type: 'TRUE_FALSE', blocks: [opt(2, [{ id: 9, title: 'Bộ A' }])] },
  ])
  it('mỗi ô của khung kèm Teil kho cùng ô; ô kho trống vẫn có hàng', () => {
    expect(rows.map((r) => [r.section, r.teil, r.blocks.map((b) => b.id)])).toEqual([
      ['LESEN', 1, [1]], ['LESEN', 2, [2]], ['SCHREIBEN', 1, []],
    ])
  })
  it('bắt buộc đủ mọi ô; Teil đã trong bộ khác tính là thiếu khi chưa cho dùng lại', () => {
    const choices = { 'LESEN#1': 1, 'LESEN#2': 2 }
    expect(blueprintSelection(rows, choices, false).missing).toEqual(['LESEN#2', 'SCHREIBEN#1'])
    expect(blueprintSelection(rows, choices, true).missing).toEqual(['SCHREIBEN#1'])
    const full = blueprintRows({ sections: [bp.sections[0]] }, [
      { section: 'LESEN', teil: 1, type: 'x', blocks: [opt(1)] }, { section: 'LESEN', teil: 2, type: 'x', blocks: [opt(3)] },
    ])
    expect(blueprintSelection(full, { 'LESEN#1': 1, 'LESEN#2': 3 }, false)).toEqual({
      replacements: [{ section: 'LESEN', teil: 1, blockId: 1 }, { section: 'LESEN', teil: 2, blockId: 3 }], missing: [],
    })
  })
})

describe('content kho A2', () => {
  it('MULTIPLE_CHOICE (Lesen 1): title_de + context + options', () => {
    const p = blockContentToPreview({ teil: 1, type: 'MULTIPLE_CHOICE', title_de: 'Kaufhaus', context: '1. Stock: Mode',
      items: [{ id: 'LV1-1', question: 'Sie suchen Schuhe.', options: { a: '1. Stock', b: '2. Stock', c: 'anderer Stock' }, correct: 'a' }] })
    expect(p).toMatchObject({ layout: 'ARTICLE', startNumber: 1, text: { titleDe: 'Kaufhaus', context: '1. Stock: Mode' } })
    expect(p.items[0].correct).toBe('a')
  })
  it('TRUE_FALSE: gắn richtig/falsch, số câu từ 6', () => {
    const p = blockContentToPreview({ teil: 2, type: 'TRUE_FALSE', context: 'Liebe Mia', items: [{ id: 'LV2-6', question: 'S', correct: 'falsch' }] })
    expect(p).toMatchObject({ layout: 'TRUE_FALSE', startNumber: 6 })
    expect(p.items[0]).toMatchObject({ options: { richtig: 'richtig', falsch: 'falsch' }, correct: 'falsch' })
  })
  it('FILL_FORM: form_fields → câu (field, answer, accept)', () => {
    const p = blockContentToPreview({ teil: 1, type: 'FILL_FORM', context: 'Anna', form_title: 'Anmeldung', max_points: 5,
      form_fields: [{ field: 'Tag', answer: 'Montag', accept: ['Mo'], explanation_vi: 'E' }] })
    expect(p.layout).toBe('FILL_FORM')
    expect(p.text).toMatchObject({ titleDe: 'Anmeldung', context: 'Anna' })
    expect(p.items[0]).toMatchObject({ question: 'Tag', correct: 'Montag', meta: { accept: 'Mo' }, explanationVi: 'E' })
  })
  it('WRITE_NOTE: prompt + writing_points', () => {
    const p = blockContentToPreview({ teil: 2, type: 'WRITE_NOTE', prompt: 'Sie sind krank.', writing_points: ['a', 'b', 'c', 'd'], choose_points: 3 })
    expect(p.layout).toBe('WRITE_NOTE')
    expect(p.text.stimulus).toMatchObject({ type: 'SITUATION', body: 'Sie sind krank.' })
    expect(p.text.writingPoints).toHaveLength(4)
  })
})
