/** Xưởng đề — Lesen Teil 1 (MATCH_HEADLINE): tách/ghép 5 văn bản, đếm từ, bảng 10 tiêu đề a–j, đọc content kho. */
import { describe, it, expect } from 'vitest'
import {
  countWords, headlineIssues, headlineTable, hasHeadlineIssues, isMatchHeadline, joinMatchTexts,
  matchTextInRange, matchTextIndex, splitMatchTexts,
} from '@/lib/examStudioLogic'
import { blockContentToPreview } from '@/components/admin/exam-studio/BlockPreviewModal'

const words = (n: number) => Array.from({ length: n }, (_, i) => `Wort${i}`).join(' ')

describe('tách / ghép văn bản', () => {
  it('tách theo dòng trống và đệm đủ số văn bản', () => {
    expect(splitMatchTexts('Eins\n\nZwei\n  \nDrei', 5)).toEqual(['Eins', 'Zwei', 'Drei', '', ''])
    expect(splitMatchTexts(null, 2)).toEqual(['', ''])
  })
  it('ghép bằng \n\n, gộp dòng trống bên trong một ô để không lệch số văn bản', () => {
    const joined = joinMatchTexts(['  A1\n\nA2 ', 'B', 'C\nC2'])
    expect(joined).toBe('A1\nA2\n\nB\n\nC\nC2')
    expect(splitMatchTexts(joined, 3)).toEqual(['A1\nA2', 'B', 'C\nC2'])
  })
  it('vị trí văn bản theo id câu', () => {
    expect(matchTextIndex('LV1-3', 0)).toBe(2)
    expect(matchTextIndex('x', 4)).toBe(4)
  })
})

describe('đếm từ', () => {
  it('bỏ dấu câu đứng riêng, tính chữ có dấu tiếng Đức', () => {
    expect(countWords('Die Bürger – müssen 2024 zahlen.')).toBe(5)
    expect(countWords('   ')).toBe(0)
  })
  it('khoảng 55–110 từ mỗi văn bản', () => {
    expect(matchTextInRange(words(54))).toBe(false)
    expect(matchTextInRange(words(55))).toBe(true)
    expect(matchTextInRange(words(110))).toBe(true)
    expect(matchTextInRange(words(111))).toBe(false)
  })
})

const item = (id: string, options: Record<string, string>, correct: string) => ({ id, options, correct })
const good = [
  item('LV1-1', { a: 'Neue Busse', f: 'Alte Busse' }, 'a'),
  item('LV1-2', { b: 'Mieten steigen', g: 'Mieten sinken' }, 'b'),
  item('LV1-3', { c: 'Mehr Sport', h: 'Weniger Sport' }, 'h'),
  item('LV1-4', { d: 'Schule digital', i: 'Schule analog' }, 'd'),
  item('LV1-5', { e: 'Gesund essen', j: 'Fast Food' }, 'e'),
]

describe('bảng 10 tiêu đề', () => {
  it('xếp theo chữ cái, đánh dấu tiêu đề đúng', () => {
    const rows = headlineTable(good)
    expect(rows.map((r) => r.letter).join('')).toBe('abcdefghij')
    expect(rows.find((r) => r.letter === 'h')).toMatchObject({ correct: true, itemIndex: 2 })
    expect(rows.find((r) => r.letter === 'c')?.correct).toBe(false)
    expect(hasHeadlineIssues(headlineIssues(good))).toBe(false)
  })
  it('báo trùng chữ, trùng nội dung, thiếu chữ, chữ lạ, câu hỏng', () => {
    const bad = [
      ...good.slice(0, 3),
      item('LV1-4', { a: 'Schule digital', i: 'neue busse.' }, 'a'),
      item('LV1-5', { e: 'Gesund essen', k: 'Fast Food' }, 'z'),
    ]
    const issues = headlineIssues(bad)
    expect(issues.duplicateLetters).toEqual(['a'])
    expect(issues.duplicateTexts).toEqual(['Neue Busse'])
    expect(issues.missingLetters).toEqual(['d', 'j'])
    expect(issues.invalidLetters).toEqual(['k'])
    expect(issues.badItems).toEqual(['LV1-5'])
  })
})

describe('content kho Lesen T1', () => {
  it('đọc khuôn đề thật: headlines a–j, items có text riêng, quelle trong source', () => {
    const p = blockContentToPreview({
      teil: 1, type: 'MATCH_HEADLINE', single_use: true,
      headlines: { b: 'Zwei', a: 'Eins' },
      source: { quelle: 'Daten: X' },
      items: [{ id: 'LV1-1', question: 'Text 1', text: 'Erster Text', correct: 'b', explanation_vi: 'Vì…' }],
    })
    expect(isMatchHeadline('match_headline')).toBe(true)
    expect(p.layout).toBe('MATCH_HEADLINE')
    expect(Object.keys(p.headlines ?? {})).toEqual(['a', 'b'])
    expect(p.items[0]).toMatchObject({ text: 'Erster Text', correct: 'b', options: { b: 'Zwei' }, explanationVi: 'Vì…' })
    expect(p.quelle).toBe('Daten: X')
    expect(p.startNumber).toBe(1)
  })
  it('content T2 vẫn đọc như cũ', () => {
    const p = blockContentToPreview({ text: { titleDe: 'T', context: 'A\n\nB' }, items: [{ id: 'x', options: { a: '1', b: '2', c: '3' }, correct: 'c' }] })
    expect(p.layout).toBe('ARTICLE')
    expect(p.items[0].correct).toBe('c')
    expect(p.startNumber).toBe(6)
  })
})
