import { describe, expect, it } from 'vitest'
import type { SavedWord } from '@/lib/myWordsApi'
import { passageHref } from '@/lib/myWordsApi'
import { filterWords, groupWords, teilLabel } from './groups'

const w = (id: number, o: Partial<SavedWord>): SavedWord => ({
  id, lemma: `Wort${id}`, article: null, pos: null, meaning: null, topic: null, topicLabel: null,
  surface: `Wort${id}`, sentence: null, examId: null, examTitle: null, teilKey: null,
  block: null, start: null, end: null, createdAt: '2026-11-13T00:00:00Z', alreadySaved: false, ...o,
})

describe('sổ từ — nhóm', () => {
  const words = [
    w(1, { topic: 'Wohnen', topicLabel: 'Nhà ở', examId: 7, examTitle: 'Modelltest 1', teilKey: 'LESEN-2' }),
    w(2, { topic: null, examId: 8, examTitle: 'Modelltest 2', teilKey: 'LESEN-1' }),
    w(3, { topic: 'Reise', topicLabel: 'Du lịch', examId: 7, examTitle: 'Modelltest 1', teilKey: 'LESEN-2' }),
    w(4, { topic: 'Wohnen', topicLabel: 'Nhà ở' }),
  ]

  it('theo chủ đề: xếp theo nhãn, chưa phân loại cuối, giữ thứ tự trong nhóm', () => {
    const g = groupWords(words, 'topic')
    expect(g.map((x) => x.label)).toEqual(['Du lịch', 'Nhà ở', null])
    expect(g[1].words.map((x) => x.id)).toEqual([1, 4])
  })

  it('theo bài: mỗi đề × Teil một nhóm theo thứ tự lưu gần nhất, không rõ bài cuối', () => {
    const g = groupWords(words, 'passage')
    expect(g.map((x) => [x.label, x.sub])).toEqual([
      ['Modelltest 1', 'Lesen 2'],
      ['Modelltest 2', 'Lesen 1'],
      [null, null],
    ])
    expect(g[0].words.map((x) => x.id)).toEqual([1, 3])
  })

  it('lọc theo dạng gốc, chữ bôi, nghĩa', () => {
    const ws = [w(1, { lemma: 'Wohnung', meaning: 'căn hộ' }), w(2, { lemma: 'fahren', surface: 'fuhr', meaning: 'đi xe' })]
    expect(filterWords(ws, 'FUHR').map((x) => x.id)).toEqual([2])
    expect(filterWords(ws, 'căn').map((x) => x.id)).toEqual([1])
    expect(filterWords(ws, '  ')).toHaveLength(2)
  })

  it('nhãn Teil', () => {
    expect(teilLabel('LESEN-2')).toBe('Lesen 2')
    expect(teilLabel('SPRACHBAUSTEINE-1')).toBe('Sprachbausteine 1')
    expect(teilLabel('HOEREN-3')).toBe('Hören 3')
    expect(teilLabel(null)).toBeNull()
  })

  it('đường mở trong bài: có vị trí ⇒ kèm at + w; không có đề ⇒ null', () => {
    const href = passageHref(w(1, { examId: 7, teilKey: 'LESEN-2', block: 'q:LV2-6', start: 3, end: 9, surface: 'leitet' }))!
    const p = new URL(href, 'https://x.test').searchParams
    expect(p.get('examId')).toBe('7')
    expect(p.get('teil')).toBe('LESEN-2')
    expect(p.get('at')).toBe('q:LV2-6:3:9')
    expect(p.get('w')).toBe('leitet')
    expect(passageHref(w(2, {}))).toBeNull()
  })
})
