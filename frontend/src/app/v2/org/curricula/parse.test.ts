import { describe, expect, it } from 'vitest'
import { parseItemLines, parseObjectiveLines, serializeItems, serializeObjectives } from './parse'

describe('parse — cú pháp dòng soạn nhanh mục nội dung/mục tiêu', () => {
  it('parseItemLines: tách text, tag kỹ năng, tag nội dung và phút ~N', () => {
    const items = parseItemLines('Chào hỏi và tạm biệt #SPRECHEN #REDEMITTEL ~120\nSố đếm 0–20 #WORTSCHATZ')
    expect(items).toEqual([
      { text: 'Chào hỏi và tạm biệt', skillTag: 'SPRECHEN', contentTag: 'REDEMITTEL', estimatedMinutes: 120 },
      { text: 'Số đếm 0–20', skillTag: null, contentTag: 'WORTSCHATZ', estimatedMinutes: null },
    ])
  })

  it('parseItemLines: bỏ dòng trống; tag lạ và ~không-phải-số giữ nguyên trong text (không nuốt im lặng)', () => {
    const items = parseItemLines('\n  \nÔn tập #XYZ ~abc\n')
    expect(items).toEqual([
      { text: 'Ôn tập #XYZ ~abc', skillTag: null, contentTag: null, estimatedMinutes: null },
    ])
  })

  it('parseObjectiveLines: nhận cấp CEFR #A1 và kỹ năng; không có estimatedMinutes', () => {
    const objectives = parseObjectiveLines('Ich kann mich begrüßen. #A1 #SPRECHEN')
    expect(objectives).toEqual([
      { text: 'Ich kann mich begrüßen.', cefrLevel: 'A1', skillTag: 'SPRECHEN' },
    ])
  })

  it('round-trip: serialize → parse giữ nguyên dữ liệu (item + objective)', () => {
    const itemsText = serializeItems([
      { id: 1, orderIndex: 0, text: 'Begrüßung', skillTag: 'SPRECHEN', contentTag: 'REDEMITTEL', estimatedMinutes: 90 },
      { id: 2, orderIndex: 1, text: 'Zahlen', skillTag: null, contentTag: null, estimatedMinutes: null },
    ])
    expect(parseItemLines(itemsText)).toEqual([
      { text: 'Begrüßung', skillTag: 'SPRECHEN', contentTag: 'REDEMITTEL', estimatedMinutes: 90 },
      { text: 'Zahlen', skillTag: null, contentTag: null, estimatedMinutes: null },
    ])

    const objText = serializeObjectives([
      { id: 3, orderIndex: 0, text: 'Ich kann zählen.', cefrLevel: 'A1', skillTag: 'HOEREN' },
    ])
    expect(parseObjectiveLines(objText)).toEqual([
      { text: 'Ich kann zählen.', cefrLevel: 'A1', skillTag: 'HOEREN' },
    ])
  })
})
