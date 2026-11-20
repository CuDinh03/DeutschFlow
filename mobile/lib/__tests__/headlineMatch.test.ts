import { answeredItems, CLEARED, holderOf, nextOpenItem, pickHeadline, usedHeadlines } from '@/lib/headlineMatch'

const ids = ['1', '2', '3', '4', '5']

describe('nextOpenItem — đoạn kế chưa có tiêu đề', () => {
  test('tìm sau đoạn hiện tại, vòng lại từ đầu, bỏ qua đoạn đã có', () => {
    expect(nextOpenItem(ids, { '1': 'a', '2': 'c' }, '2')).toBe('3')
    expect(nextOpenItem(ids, { '3': 'a', '4': 'b', '5': 'c' }, '4')).toBe('1')
    expect(nextOpenItem(ids, {}, null)).toBe('1')
  })
  test('đủ hết (hoặc chỉ còn chính đoạn đang mở) ⇒ null; đáp án rỗng tính là chưa có', () => {
    expect(nextOpenItem(ids, { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e' }, '3')).toBeNull()
    expect(nextOpenItem(ids, { '1': 'a', '2': 'b', '4': 'd', '5': 'e' }, '3')).toBeNull()
    expect(nextOpenItem(ids, { '1': 'a', '2': ' ' }, '1')).toBe('2')
    expect(nextOpenItem([], {}, null)).toBeNull()
  })
})

describe('holderOf / usedHeadlines / answeredItems', () => {
  const answers = { '1': 'a', '3': 'f', '4': '' }
  test('đoạn khác đang giữ tiêu đề', () => {
    expect(holderOf(ids, answers, 'f', '2')).toBe('3')
    expect(holderOf(ids, answers, 'f', '3')).toBeNull()
    expect(holderOf(ids, answers, 'z', '2')).toBeNull()
  })
  test('tiêu đề đã dùng và số đoạn đã có', () => {
    expect([...usedHeadlines(ids, answers)].sort()).toEqual(['a', 'f'])
    expect(answeredItems(ids, answers)).toBe(2)
  })
})

describe('pickHeadline', () => {
  test('chọn tiêu đề trống ⇒ gắn, sang đoạn kế chưa có', () => {
    expect(pickHeadline(ids, { '1': 'a' }, '2', 'c')).toEqual({ changes: [['2', 'c']], next: '3' })
  })
  test('tiêu đề đang ở đoạn khác ⇒ chuyển (bỏ ở đoạn cũ trước), đoạn cũ thành đoạn kế', () => {
    expect(pickHeadline(ids, { '1': 'a', '2': 'c', '4': 'd', '5': 'e' }, '3', 'a')).toEqual({
      changes: [['1', CLEARED], ['3', 'a']],
      next: '1',
    })
  })
  test('chạm lại tiêu đề đang có ⇒ bỏ chọn, ở lại đoạn đó', () => {
    expect(pickHeadline(ids, { '2': 'c' }, '2', 'c')).toEqual({ changes: [['2', CLEARED]], next: '2' })
  })
  test('đoạn cuối cùng ⇒ next null (đóng khay); không đổi bộ đáp án gốc', () => {
    const answers = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' }
    expect(pickHeadline(ids, answers, '5', 'e').next).toBeNull()
    expect(answers).toEqual({ '1': 'a', '2': 'b', '3': 'c', '4': 'd' })
  })
})
