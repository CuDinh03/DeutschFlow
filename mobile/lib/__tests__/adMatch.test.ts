import { assignAd, situationNo, situationsOf } from '@/lib/adMatch'

const ids = ['LV3-11', 'LV3-12', 'LV3-13']

describe('assignAd — chạm mẩu tin để gán cho tình huống', () => {
  test('gán mẩu cho tình huống trống', () => {
    expect(assignAd(ids, {}, 'LV3-12', 'c', true)).toEqual([['LV3-12', 'c']])
  })
  test('mỗi mẩu một lần: mẩu đang ở tình huống khác thì chuyển sang (bỏ ở chỗ cũ trước)', () => {
    expect(assignAd(ids, { 'LV3-11': 'c' }, 'LV3-13', 'c', true)).toEqual([['LV3-11', ''], ['LV3-13', 'c']])
  })
  test('không giới hạn một lần thì giữ chỗ cũ', () => {
    expect(assignAd(ids, { 'LV3-11': 'c' }, 'LV3-13', 'c', false)).toEqual([['LV3-13', 'c']])
  })
  test('thay đáp án cũ của tình huống (kể cả x); chạm lại đúng mẩu đang chọn thì bỏ', () => {
    expect(assignAd(ids, { 'LV3-12': 'x' }, 'LV3-12', 'a', true)).toEqual([['LV3-12', 'a']])
    expect(assignAd(ids, { 'LV3-12': 'a' }, 'LV3-12', 'a', true)).toEqual([['LV3-12', '']])
  })
})

describe('situationsOf / situationNo', () => {
  test('tìm tình huống đang dùng mẩu; số lấy từ mã câu', () => {
    expect(situationsOf(ids, { 'LV3-11': 'b', 'LV3-13': 'b', 'LV3-12': 'x' }, 'b')).toEqual(['LV3-11', 'LV3-13'])
    expect(situationNo('LV3-14', 0)).toBe('14')
    expect(situationNo('abc', 2)).toBe('3')
  })
})
