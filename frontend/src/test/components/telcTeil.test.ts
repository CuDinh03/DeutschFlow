/**
 * Phép thuần của bốn dạng bài telc. Ba thứ dễ sai và tốn tiền nếu sai:
 * khoá "mỗi lựa chọn một lần", đáp án `x` không bị khoá, và việc cắt ô trống trong văn bản.
 */
import { describe, it, expect } from 'vitest'
import {
  telcTeilType,
  telcOptionPool,
  telcUsedKeys,
  parseGappedText,
  itemGapNumber,
  itemsByGap,
  NONE_OF_THEM,
} from '@/components/exam/telc/telcTeil'

describe('dạng bài telc', () => {
  it('chỉ nhận đúng bốn dạng telc, dạng lạ trả null để đi nhánh cũ', () => {
    expect(telcTeilType({ teil: 1, type: 'MATCH_HEADLINE' })).toBe('MATCH_HEADLINE')
    expect(telcTeilType({ teil: 2, type: 'GAP_WORDBANK' })).toBe('GAP_WORDBANK')
    expect(telcTeilType({ teil: 1, type: 'PLAN_TOGETHER' })).toBeNull()
    expect(telcTeilType({ teil: 1 })).toBeNull()
  })

  it('kho lựa chọn xếp theo thứ tự chữ cái để đối chiếu được với đề giấy', () => {
    const pool = telcOptionPool({ teil: 1, headlines: { c: 'Ce', a: 'Aa', b: 'Be' } })
    expect(pool.map((o) => o.key)).toEqual(['a', 'b', 'c'])
    expect(pool[0].label).toBe('Aa')
  })

  it('Teil thiếu kho lựa chọn trả về rỗng — nơi gọi phải báo, không vẽ ô không bấm được', () => {
    expect(telcOptionPool({ teil: 1 })).toEqual([])
  })
})

describe('khoá mỗi lựa chọn một lần', () => {
  const items = [{ id: 'LV1-1' }, { id: 'LV1-2' }, { id: 'LV1-3' }]

  it('chữ cái câu khác đã chọn thì bị khoá, chữ cái của chính câu này thì không', () => {
    const teil = { teil: 1, headlines: { a: 'A', b: 'B', c: 'C' } }
    const answers = { 'LV1-1': 'a', 'LV1-2': 'b' }

    expect(telcUsedKeys(teil, items, answers, 'LV1-1')).toEqual(new Set(['b']))
    expect(telcUsedKeys(teil, items, answers, 'LV1-3')).toEqual(new Set(['a', 'b']))
  })

  it('đáp án x KHÔNG bao giờ bị khoá — nhiều tình huống cùng có thể "không mẩu nào hợp"', () => {
    const teil = { teil: 3, ads: { a: 'A', b: 'B' }, allow_none: true }
    const answers = { 'LV1-1': NONE_OF_THEM, 'LV1-2': NONE_OF_THEM }

    expect(telcUsedKeys(teil, items, answers, 'LV1-3')).toEqual(new Set())
  })

  it('Teil khai single_use false thì không khoá gì', () => {
    const teil = { teil: 1, headlines: { a: 'A' }, single_use: false }
    expect(telcUsedKeys(teil, items, { 'LV1-1': 'a' }, 'LV1-2')).toEqual(new Set())
  })
})

describe('văn bản có ô trống', () => {
  it('cắt đúng chữ và ô trống theo thứ tự', () => {
    expect(parseGappedText('Liebe Frau Weber, ich schreibe ___21___ ich krank bin.')).toEqual([
      { kind: 'text', value: 'Liebe Frau Weber, ich schreibe ' },
      { kind: 'gap', gap: 21 },
      { kind: 'text', value: ' ich krank bin.' },
    ])
  })

  it('hai ô trống liền nhau và ô ở cuối câu vẫn cắt đúng', () => {
    const segments = parseGappedText('A ___1___ B ___2___')
    expect(segments).toEqual([
      { kind: 'text', value: 'A ' },
      { kind: 'gap', gap: 1 },
      { kind: 'text', value: ' B ' },
      { kind: 'gap', gap: 2 },
    ])
  })

  it('văn bản không có ô trống vẫn dựng được nguyên văn', () => {
    expect(parseGappedText('Kein Lückentext.')).toEqual([{ kind: 'text', value: 'Kein Lückentext.' }])
  })

  it('số ô lấy từ khoá gap, thiếu thì lấy cụm số cuối của id', () => {
    expect(itemGapNumber({ id: 'SB1-21', gap: 7 })).toBe(7)
    expect(itemGapNumber({ id: 'SB2-31' })).toBe(31)
    expect(itemGapNumber({ id: 'khong-co-so' })).toBeNull()
  })

  it('tra được câu theo số ô', () => {
    const map = itemsByGap([{ id: 'SB1-21' }, { id: 'SB1-22' }])
    expect(map.get(21)?.id).toBe('SB1-21')
    expect(map.get(99)).toBeUndefined()
  })
})
