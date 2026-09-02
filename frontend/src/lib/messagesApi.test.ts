import { describe, it, expect } from 'vitest'
import { sameMessageIds } from './messagesApi'

// W5 audit lag 02/09: vòng poll giữ nguyên reference mảng cũ khi không có gì mới —
// sameMessageIds là cái then quyết định "không có gì mới" cho luồng chat append-only có xoá.
describe('sameMessageIds', () => {
  const m = (id: number) => ({ id })

  it('empty vs empty là giống nhau', () => {
    expect(sameMessageIds([], [])).toBe(true)
  })

  it('cùng (độ dài, id đầu, id cuối) → giống nhau', () => {
    expect(sameMessageIds([m(1), m(2), m(3)], [m(1), m(2), m(3)])).toBe(true)
  })

  it('tin mới append vào cuối → khác nhau', () => {
    expect(sameMessageIds([m(1), m(2)], [m(1), m(2), m(3)])).toBe(false)
  })

  it('tin cuối bị xoá → khác nhau', () => {
    expect(sameMessageIds([m(1), m(2), m(3)], [m(1), m(2)])).toBe(false)
  })

  it('xoá một tin giữa + một tin mới đến cùng tick (độ dài bằng nhau) → khác nhau', () => {
    // id tăng dần nên tin mới luôn nằm cuối — id cuối đổi là bắt được.
    expect(sameMessageIds([m(1), m(2), m(3)], [m(1), m(3), m(4)])).toBe(false)
  })

  it('mảng rỗng vs có tin → khác nhau', () => {
    expect(sameMessageIds([], [m(1)])).toBe(false)
  })
})
