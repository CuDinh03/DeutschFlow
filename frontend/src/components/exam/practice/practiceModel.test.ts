import { describe, expect, it } from 'vitest'
import {
  displayedPoints,
  essaySegments,
  findTeil,
  itemLabel,
  kindOf,
  labelForLogical,
  nextUnanswered,
  ownerOf,
  relabelLeitpunkte,
  wordCount,
} from './practiceModel'
import type { WritingAnnotation } from '@/lib/telcPracticeApi'

const note = (over: Partial<WritingAnnotation>): WritingAnnotation => ({
  quote: null,
  insertAfter: null,
  correction: '',
  category: 'GRAMMATIK',
  kriterium: null,
  leitpunkt: null,
  whyVi: 'vì sao',
  ruleVi: '',
  ...over,
})

describe('practiceModel', () => {
  const json = JSON.stringify({
    sections: [
      { name: 'LESEN', teile: [{ teil: 1, type: 'MATCH_HEADLINE' }, { teil: 2, type: 'MULTIPLE_CHOICE' }] },
      { name: 'SPRACHBAUSTEINE', teile: [{ teil: 2, type: 'GAP_WORDBANK' }] },
    ],
  })

  it('tìm Teil theo khoá và suy dạng bài', () => {
    expect(findTeil(json, 'LESEN-2')?.type).toBe('MULTIPLE_CHOICE')
    expect(kindOf(findTeil(json, 'SPRACHBAUSTEINE-2'), 'SPRACHBAUSTEINE-2')).toBe('gap-bank')
    expect(kindOf(null, 'SCHREIBEN-1')).toBe('writing')
    expect(findTeil(json, 'HOEREN-1')).toBeNull()
    expect(findTeil('không phải json', 'LESEN-1')).toBeNull()
  })

  it('nhãn câu: số ô, số bài, hoặc số cuối id', () => {
    expect(itemLabel({ id: 'SB2-31', gap: 31 })).toBe('31')
    expect(itemLabel({ id: 'LV1-3', question: 'Text 3' })).toBe('3')
    expect(itemLabel({ id: 'LV3-14', question: 'Ihr Fahrrad ist kaputt' })).toBe('14')
  })

  it('mỗi lựa chọn thuộc một câu; x không thuộc câu nào', () => {
    const items = [{ id: 'a1' }, { id: 'a2' }]
    expect(ownerOf({ a1: 'c' }, 'c', items)).toBe('a1')
    expect(ownerOf({ a1: 'x', a2: 'x' }, 'x', items)).toBeUndefined()
  })

  it('câu chưa làm kế tiếp vòng lại từ đầu', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }]
    expect(nextUnanswered(items, { 2: 'a' }, '2')).toBe('3')
    expect(nextUnanswered(items, { 2: 'a', 3: 'b' }, '3')).toBe('1')
    expect(nextUnanswered(items, { 1: 'a', 2: 'a', 3: 'b' })).toBeNull()
  })

  it('Leitpunkte in xáo vẫn đổi được số gốc sang nhãn P người học thấy', () => {
    const points = ['eins', 'zwei', 'drei', 'vier']
    const shown = displayedPoints(points, true)
    expect(shown.map((p) => p.label)).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect(shown.map((p) => p.text).sort()).toEqual([...points].sort())
    const vier = shown.find((p) => p.text === 'vier')!
    expect(labelForLogical(shown, 4)).toBe(vier.label)
    expect(labelForLogical(shown, null)).toBeNull()
  })

  it('tô ghi chú: trích dẫn thành mark, ý thiếu chèn sau đoạn neo', () => {
    const text = 'Hallo Lena, ich gratuliere dir zu der neuen Arbeit. Bis bald'
    const segs = essaySegments(text, [
      note({ quote: 'zu der neuen Arbeit' }),
      note({ insertAfter: 'Arbeit.' }),
      note({ quote: 'gibt es nicht' }),
    ])
    expect(segs).toEqual([
      { kind: 'text', value: 'Hallo Lena, ich gratuliere dir ' },
      { kind: 'mark', value: 'zu der neuen Arbeit', note: 0 },
      { kind: 'text', value: '.' },
      { kind: 'insert', note: 1 },
      { kind: 'text', value: ' Bis bald' },
    ])
  })

  it('chữ tự do của AI gọi Leitpunkt theo số gốc thì đổi sang nhãn P đang hiện', () => {
    const shown = displayedPoints(['eins', 'zwei', 'drei', 'vier'], true)
    const p = (n: number) => labelForLogical(shown, n)!
    expect(relabelLeitpunkte('Thiếu Leitpunkt 2, ảnh hưởng tiêu chí I.', shown)).toBe(`Thiếu Leitpunkt ${p(2)}, ảnh hưởng tiêu chí I.`)
    expect(relabelLeitpunkte('Thiếu các Leitpunkte 2 (thành phố mới), 3 (chỗ ở) và 4 (tin mới).', shown)).toBe(
      `Thiếu các Leitpunkte ${p(2)} (thành phố mới), ${p(3)} (chỗ ở) và ${p(4)} (tin mới).`,
    )
    // không đụng số khác trong câu (ngày tháng, điểm)
    expect(relabelLeitpunkte('Am 15. Juli, 3 Punkte, Leitpunkt 1.', shown)).toBe(`Am 15. Juli, 3 Punkte, Leitpunkt ${p(1)}.`)
    expect(relabelLeitpunkte(null, shown)).toBe('')
  })

  it('ý thiếu không định vị được thì đặt cuối bài; hai ý thiếu cùng chỗ đều hiện', () => {
    const text = 'Hallo Lena, ja. Tschüss'
    const segs = essaySegments(text, [
      note({ insertAfter: 'ja.', leitpunkt: 1 }),
      note({ insertAfter: 'ja.', leitpunkt: 2 }),
      note({ insertAfter: 'không có trong bài', leitpunkt: 4 }),
      note({ insertAfter: 'không có trong bài' }),
    ])
    expect(segs).toEqual([
      { kind: 'text', value: 'Hallo Lena, ja.' },
      { kind: 'insert', note: 0 },
      { kind: 'insert', note: 1 },
      { kind: 'text', value: ' Tschüss' },
      { kind: 'insert', note: 2 },
    ])
  })

  it('đếm từ', () => {
    expect(wordCount('  Hallo   Lena,\nwie geht es? ')).toBe(5)
    expect(wordCount('')).toBe(0)
  })
})
