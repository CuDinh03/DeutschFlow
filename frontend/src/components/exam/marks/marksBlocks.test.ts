import { describe, expect, it } from 'vitest'
import { blockOrderOf, evidenceBlocks, evidencePieces, gapPieces, marksSupported, marksTexts } from './marksBlocks'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'

const LESEN1: PracticeTeilData = {
  teil: 1,
  type: 'MATCH_HEADLINE',
  headlines: { a: 'Neue Radwege', b: 'Markthalle öffnet' },
  items: [
    { id: 'LV1-1', question: 'Text 1', text: 'Ab Mai entstehen\r\nvier neue Strecken für Fahrräder.' },
    { id: 'LV1-2', question: 'Text 2', text: 'Die alte Markthalle öffnet wieder.' },
  ],
}
const LESEN3: PracticeTeilData = {
  teil: 3,
  type: 'MATCH_AD_X',
  ads: { a: 'Nachhilfe Mathe, Klasse 5–10.', b: 'Babysitterin hat abends Zeit.' },
  items: [{ id: 'LV3-11', question: 'Ihre Tochter braucht Hilfe in Mathe.' }],
}
const SB: PracticeTeilData = {
  teil: 1,
  type: 'GAP_MC',
  gapped_text: 'Sehr geehrte ___21___ Herren,\r\nich wohne ___22___ drei Jahren hier.',
  items: [{ id: 'SB1-21', gap: 21, options: { a: 'Damen', b: 'Frauen' } }],
}

describe('marksBlocks (đợt 3)', () => {
  it('khối chữ từng dạng Teil, xuống dòng chuẩn hoá như server', () => {
    expect(Object.keys(marksTexts(LESEN1))).toEqual(['q:LV1-1', 't:LV1-1', 'q:LV1-2', 't:LV1-2'])
    expect(marksTexts(LESEN1)['t:LV1-1']).toBe('Ab Mai entstehen\nvier neue Strecken für Fahrräder.')
    expect(Object.keys(marksTexts(LESEN3))).toEqual(['ad:a', 'ad:b', 'q:LV3-11'])
    expect(marksTexts(SB).gap).toBe('Sehr geehrte ___21___ Herren,\nich wohne ___22___ drei Jahren hier.')
  })

  it('Teil có bút đánh dấu: Lesen 1–3, Sprachbausteine; không có chữ thì không', () => {
    expect(marksSupported(LESEN1, 'match')).toBe(true)
    expect(marksSupported(LESEN3, 'match')).toBe(true)
    expect(marksSupported(SB, 'gap-mc')).toBe(true)
    expect(marksSupported({ context: 'x' }, 'mc')).toBe(true)
    expect(marksSupported({}, 'mc')).toBe(false)
    expect(marksSupported({ type: 'MATCH_AD_X', ads: {} }, 'match')).toBe(false)
    expect(marksSupported({ items: [{ id: 'H1' }] }, 'mc')).toBe(false)
    expect(marksSupported(null, 'mc')).toBe(false)
  })

  it('bằng chứng tìm trong khối của câu: Lesen 1 đoạn văn, Lesen 3 rao vặt rồi tình huống', () => {
    const t1 = marksTexts(LESEN1)
    expect(evidenceBlocks(LESEN1, 'match', 'LV1-1')).toEqual(['t:LV1-1'])
    expect(evidencePieces(t1, ['t:LV1-1'], ['entstehen vier neue', 'gibt es nicht'])).toEqual([
      { b: 't:LV1-1', s: 7, e: 26 },
    ])
    const t3 = marksTexts(LESEN3)
    const blocks = evidenceBlocks(LESEN3, 'match', 'LV3-11')
    expect(blocks).toEqual(['ad:a', 'ad:b', 'q:LV3-11'])
    expect(evidencePieces(t3, blocks, ['Nachhilfe Mathe', 'Hilfe in Mathe']).map((p) => p.b)).toEqual(['ad:a', 'q:LV3-11'])
  })

  it('thứ tự khối: bài/thư → rao vặt → câu', () => {
    const o = blockOrderOf(LESEN3)
    expect(o('ad:a')).toBeLessThan(o('ad:b'))
    expect(o('ad:b')).toBeLessThan(o('q:LV3-11'))
    const o1 = blockOrderOf(LESEN1)
    expect(o1('t:LV1-1')).toBeLessThan(o1('q:LV1-1'))
    expect(o1('q:LV1-1')).toBeLessThan(o1('t:LV1-2'))
  })

  it('thư có chỗ trống: các đoạn chữ giữ vị trí trên chữ đã chuẩn hoá', () => {
    const text = marksTexts(SB).gap
    const pieces = gapPieces(text)
    expect(pieces.map((p) => (p.kind === 'gap' ? `#${p.gap}` : text.slice(p.s, p.e)))).toEqual([
      'Sehr geehrte ',
      '#21',
      ' Herren,\nich wohne ',
      '#22',
      ' drei Jahren hier.',
    ])
  })
})
