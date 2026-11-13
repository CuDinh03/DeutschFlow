/**
 * Xưởng đề đợt 3 — logic thuần: dạng Teil, ma trận cho Teil 10 câu / Schreiben, thư có ô (SB1/SB2), vai trò
 * 12 mẩu rao vặt (LV3), hộp từ (SB2), tách id Teil kho khỏi detail, lọc Teil kho theo usedIn/allowReuse.
 */
import { describe, it, expect } from 'vitest'
import { DIFFICULTY_PRESETS, type StudioDraft } from '@/lib/adminExamStudioApi'
import {
  adIssues, adRoles, approveBlockers, assemblyReplacements, assemblyRows, blockIdFromDetail, blockSelectable,
  buildGappedText, catalogEntry, checkMatrix, CHECKLIST_KEYS, inWordRange, AD_WORD_RANGE, itemNumber, locateGap,
  maxReachableStep, parseGappedText, planTotal, pruneChoices, scalePlan, teilKind, wordBankIssues, wordBankRows,
} from '@/lib/examStudioLogic'
import { blockContentToPreview } from '@/components/admin/exam-studio/BlockPreviewModal'

describe('dạng Teil + danh mục', () => {
  it('teilKind: MULTIPLE_CHOICE / lạ → ARTICLE', () => {
    expect(teilKind('MULTIPLE_CHOICE')).toBe('ARTICLE')
    expect(teilKind(null)).toBe('ARTICLE')
    expect(teilKind('gap_wordbank')).toBe('GAP_WORDBANK')
    expect(teilKind('WRITE_EMAIL')).toBe('WRITE_EMAIL')
  })
  it('danh mục khớp số câu đề thật; Hören B1 có từ đợt 5', () => {
    expect(catalogEntry('LESEN', 3)).toMatchObject({ teilType: 'MATCH_AD_X', itemCount: 10, needsSources: false })
    expect(catalogEntry('SCHREIBEN', 1)?.itemCount).toBe(0)
    expect(catalogEntry('HOEREN', 1)).toMatchObject({ teilType: 'HOEREN_STATEMENTS', itemCount: 5, needsSources: false })
  })
})

describe('ma trận cho Teil 10 câu và Schreiben', () => {
  it('scalePlan giữ tổng đúng số câu', () => {
    for (const p of DIFFICULTY_PRESETS) expect(planTotal(scalePlan(p.plan, 10))).toBe(10)
    expect(scalePlan({ EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, 10)).toEqual({ EASY: 4, MEDIUM: 4, HARD: 2, EXPERT: 0 })
    expect(scalePlan({ EASY: 2, MEDIUM: 2, HARD: 1, EXPERT: 0 }, 0)).toEqual({ EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 })
  })
  it('itemCount = 0 (Schreiben): không có ma trận, luôn hợp lệ', () => {
    expect(checkMatrix({ EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }, 'EXAM', 0).valid).toBe(true)
  })
})

describe('bước và duyệt cho Teil theo tình huống', () => {
  const base = {
    mode: 'EXAM', itemCount: 10, difficultyPlan: { EASY: 4, MEDIUM: 4, HARD: 2, EXPERT: 0 },
    step: 'FRAME', sources: [], text: null, items: [], needsSources: false,
  } as unknown as StudioDraft
  it('needsSources = false: bước Tình huống luôn qua', () => {
    expect(maxReachableStep(base)).toBe(2)
  })
  it('Schreiben: có bài là sang thẳng Kiểm & duyệt; duyệt không đòi câu hỏi', () => {
    const w = { ...base, itemCount: 0, difficultyPlan: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 },
      text: { titleDe: '', vorspannDe: '', context: '', glossary: [] } } as StudioDraft
    expect(maxReachableStep(w)).toBe(4)
    const all = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true]))
    expect(approveBlockers({ status: 'DRAFT', busyOp: null, items: [], checks: [], itemCount: 0 }, all)).toEqual([])
    expect(approveBlockers({ status: 'DRAFT', busyOp: null, items: [], checks: [], itemCount: 10 }, all)).toContain('NO_ITEMS')
  })
})

describe('Sprachbausteine: định vị ô và thư có ô', () => {
  const letter = 'Liebe Anna, ich schreibe dir, weil ich Hilfe brauche. Ich hoffe, dass du Zeit hast. Viele Grüße'
  it('locateGap: cụm before + target; target duy nhất khi không có before; mơ hồ → -1', () => {
    expect(locateGap(letter, 'schreibe dir,', 'weil')).toBe(letter.indexOf('weil'))
    expect(locateGap(letter, null, 'dass')).toBe(letter.indexOf('dass'))
    expect(locateGap(letter, null, 'ich')).toBe(-1) // 2 lần
    expect(locateGap(letter, null, 'Hilf')).toBe(-1) // không phải trọn từ
    expect(locateGap(letter, 'Ich hoffe,', 'dass')).toBe(letter.indexOf('dass'))
  })
  it('buildGappedText thay đúng ô theo thứ tự trong thư, báo câu không định vị được', () => {
    const items = [
      { id: 'SB1-22', meta: { target: 'dass', before: 'hoffe,', gap: '22' } },
      { id: 'SB1-21', meta: { target: 'weil', before: 'dir,', gap: '21' } },
      { id: 'SB1-23', meta: { target: 'gibtsnicht', before: '', gap: '23' } },
    ]
    const { segments, missing } = buildGappedText(letter, items)
    expect(missing).toEqual(['SB1-23'])
    const flat = segments.map((s) => (s.kind === 'gap' ? `___${s.gap}___` : s.text)).join('')
    expect(flat).toBe(letter.replace('weil', '___21___').replace('dass', '___22___'))
    expect(segments.filter((s) => s.kind === 'gap').map((s) => s.kind === 'gap' && s.itemId)).toEqual(['SB1-21', 'SB1-22'])
  })
  it('parseGappedText đọc khuôn kho ___21___', () => {
    const segs = parseGappedText('A ___21___ B ___22___', { 21: 'SB1-21' })
    expect(segs).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'gap', gap: '21', itemId: 'SB1-21', target: null },
      { kind: 'text', text: ' B ' },
      { kind: 'gap', gap: '22', itemId: null, target: null },
    ])
  })
})

describe('Lesen T3: vai trò 12 mẩu', () => {
  const ads = Object.fromEntries('abcdefghijkl'.split('').map((k) => [k, `Anzeige ${k}`]))
  const items = [
    { id: 'LV3-11', correct: 'a', options: { a: 'x', b: 'y' } },
    { id: 'LV3-12', correct: 'x', options: { c: 'y' } },
    { id: 'LV3-13', correct: 'a', options: { a: 'x' } },
  ]
  it('đánh dấu đáp án / ví dụ / thừa và mẩu nhiễu', () => {
    const rows = adRoles(ads, items, [{ label: '01', answer: 'd' }, { label: '02', answer: 'x' }])
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ letter: 'a', role: 'ANSWER', answerFor: [11, 13] })
    expect(rows[1]).toMatchObject({ role: 'SPARE', distractorFor: [11] })
    expect(rows[3]).toMatchObject({ role: 'EXAMPLE', exampleFor: ['01'] })
  })
  it('báo số câu x ≠ 2 và mẩu làm đáp án hai lần', () => {
    expect(adIssues(items)).toEqual({ xCount: 1, duplicateAnswers: ['a'] })
  })
  it('đếm từ mẩu rao vặt 15–45', () => {
    expect(inWordRange(Array(14).fill('w').join(' '), AD_WORD_RANGE)).toBe(false)
    expect(inWordRange(Array(15).fill('w').join(' '), AD_WORD_RANGE)).toBe(true)
  })
  it('itemNumber từ id', () => {
    expect(itemNumber('LV3-13', 0)).toBe(13)
    expect(itemNumber('?', 7)).toBe(7)
  })
})

describe('Sprachbausteine T2: hộp từ', () => {
  it('đánh dấu từ đúng của ô nào, từ thừa, đếm cỡ hộp', () => {
    const bank = Object.fromEntries('abcdefghijklmno'.split('').map((k) => [k, k.toUpperCase().repeat(3)]))
    const rows = wordBankRows(bank, [
      { id: 'SB2-31', correct: 'c', meta: { gap: '31' } },
      { id: 'SB2-32', correct: 'c', meta: { gap: '32' } },
    ])
    expect(rows).toHaveLength(15)
    expect(rows[2]).toMatchObject({ letter: 'c', word: 'CCC', answerFor: ['31', '32'] })
    expect(rows[0].answerFor).toEqual([])
    expect(wordBankIssues(rows)).toEqual({ duplicateAnswers: ['c'], size: 15 })
  })
})

describe('chống trùng', () => {
  it('blockIdFromDetail tách id Teil kho', () => {
    expect(blockIdFromDetail('Giống 87% Teil kho #123 — đổi chủ đề/tình huống rồi viết lại.')).toBe(123)
    expect(blockIdFromDetail('teil kho # 9')).toBe(9)
    expect(blockIdFromDetail('Không trùng')).toBeNull()
    expect(blockIdFromDetail(null)).toBeNull()
  })

  const used = [{ id: 90, title: 'Bộ đề ghép 1' }]
  const base = { id: 7, title: 'Nền', reviewed: true, slots: [{ section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE' }] }
  const opt = (id: number, usedIn: { id: number; title: string }[] = []) =>
    ({ id, titleDe: null, theme: null, difficultyCounts: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 }, exposureCount: 0, usedIn })
  const rows = assemblyRows(base, [{ section: 'LESEN', teil: 2, type: 'MULTIPLE_CHOICE', blocks: [opt(12, used), opt(13)] }])

  it('Teil đã trong bộ khác: không chọn được trừ khi cho dùng lại', () => {
    expect(blockSelectable(opt(1, used), false)).toBe(false)
    expect(blockSelectable(opt(1, used), true)).toBe(true)
    expect(blockSelectable(opt(1), false)).toBe(true)
    expect(assemblyReplacements(rows, { 'LESEN#2': 12 })).toEqual([])
    expect(assemblyReplacements(rows, { 'LESEN#2': 12 }, true)).toEqual([{ section: 'LESEN', teil: 2, blockId: 12 }])
    expect(assemblyReplacements(rows, { 'LESEN#2': 13 })).toEqual([{ section: 'LESEN', teil: 2, blockId: 13 }])
  })
  it('tắt "Cho dùng lại" thì bỏ lựa chọn không hợp lệ', () => {
    expect(pruneChoices(rows, { 'LESEN#2': 12 }, false)).toEqual({ 'LESEN#2': null })
    expect(pruneChoices(rows, { 'LESEN#2': 13 }, false)).toEqual({ 'LESEN#2': 13 })
  })
})


describe('content kho các dạng đợt 3', () => {
  it('MATCH_AD_X', () => {
    const p = blockContentToPreview({
      teil: 3, type: 'MATCH_AD_X', allow_none: true,
      examples: [{ label: '01', situation: 'S', answer: 'c' }], ads: { b: 'B', a: 'A' },
      items: [{ id: 'LV3-11', question: 'Q', correct: 'x', explanation_vi: 'E' }],
    })
    expect(p.layout).toBe('MATCH_AD_X')
    expect(p.text.ads).toEqual({ a: 'A', b: 'B' })
    expect(p.text.examples).toEqual([{ label: '01', situation: 'S', answer: 'c' }])
    expect(p.items[0]).toMatchObject({ question: 'Q', correct: 'x', explanationVi: 'E' })
    expect(p.startNumber).toBe(11)
  })
  it('GAP_MC / GAP_WORDBANK', () => {
    const mc = blockContentToPreview({ teil: 1, type: 'GAP_MC', gapped_text: 'A ___21___', items: [{ id: 'SB1-21', gap: 21, options: { a: '1', b: '2', c: '3' }, correct: 'b' }] })
    expect(mc).toMatchObject({ layout: 'GAP_MC', gappedText: 'A ___21___', startNumber: 21 })
    expect(mc.items[0]).toMatchObject({ correct: 'b', meta: { gap: '21' }, options: { a: '1', b: '2', c: '3' } })
    const wb = blockContentToPreview({ teil: 2, type: 'GAP_WORDBANK', stimulus_ad: 'Ad', word_bank: { a: 'WEIL' }, gapped_text: 'x ___31___', items: [{ id: 'SB2-31', gap: 31, correct: 'a' }] })
    expect(wb).toMatchObject({ layout: 'GAP_WORDBANK', text: { stimulusAd: 'Ad', wordBank: { a: 'WEIL' } } })
  })
  it('Schreiben (content không có type)', () => {
    const w = blockContentToPreview({ teil: 1, stimulus: { type: 'EMAIL', from: 'Tom', subject: 'Hi', body: 'B' }, writing_points: ['1', '2', '3', '4'] })
    expect(w.layout).toBe('WRITE_EMAIL')
    expect(w.text.stimulus).toMatchObject({ from: 'Tom', subject: 'Hi', body: 'B' })
    expect(w.text.writingPoints).toHaveLength(4)
  })
})
