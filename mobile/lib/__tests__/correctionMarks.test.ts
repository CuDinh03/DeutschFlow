import { markSegments, usableErrors } from '@/lib/correctionMarks'

const joined = (segs: { text: string }[]) => segs.map((s) => s.text).join('')

describe('markSegments — đánh dấu chỗ sai/chỗ sửa', () => {
  const SENT = 'Ich arbeite in Krankenhaus und bin zuständig von zwölf Patienten.'

  test('đánh số theo thứ tự lỗi, giữ nguyên toàn bộ chữ', () => {
    const segs = markSegments(SENT, ['in Krankenhaus', 'zuständig von'])
    expect(joined(segs)).toBe(SENT)
    expect(segs.filter((s) => s.mark).map((s) => [s.text, s.mark])).toEqual([
      ['in Krankenhaus', 1],
      ['zuständig von', 2],
    ])
  })

  test('đoạn không có trong câu thì bỏ qua; khác hoa thường vẫn tìm được', () => {
    const segs = markSegments(SENT, ['gibt es nicht', 'ICH ARBEITE'])
    expect(joined(segs)).toBe(SENT)
    expect(segs.filter((s) => s.mark).map((s) => [s.text, s.mark])).toEqual([['Ich arbeite', 2]])
  })

  test('đoạn lặp lại lấy lần chưa bị chiếm; đoạn chồng lấn bị bỏ', () => {
    const segs = markSegments('der der der', ['der', 'der', 'er d'])
    expect(segs.filter((s) => s.mark).map((s) => s.mark)).toEqual([1, 2])
    expect(joined(segs)).toBe('der der der')
  })

  test('không lỗi ⇒ một đoạn thường', () => {
    expect(markSegments('Gut.', [])).toEqual([{ text: 'Gut.', mark: null }])
    expect(markSegments('', [null])).toEqual([{ text: '', mark: null }])
  })
})

describe('usableErrors', () => {
  test('bỏ lỗi thiếu đoạn hoặc sửa như không', () => {
    expect(
      usableErrors([
        { wrongSpan: 'von', correctedSpan: 'für', ruleViShort: 'zuständig für' },
        { wrongSpan: 'gut', correctedSpan: 'gut' },
        { wrongSpan: '', correctedSpan: 'x' },
        { wrongSpan: 'y', correctedSpan: null },
      ]).map((e) => e.wrongSpan),
    ).toEqual(['von'])
    expect(usableErrors(null)).toEqual([])
  })
})
