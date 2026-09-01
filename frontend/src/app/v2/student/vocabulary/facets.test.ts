import { describe, expect, it } from 'vitest'

import { NO_FILTERS, filterParams, genderChipColor, hasAnyFilter, toggleAxis } from './facets'

describe('filterParams', () => {
  it('chỉ gửi locale khi chưa lọc gì', () => {
    expect(filterParams(NO_FILTERS, 'vi', '')).toEqual({ locale: 'vi' })
  })

  it('cấp độ luôn đi kèm exact=true — chip A2 phải trả ĐÚNG từ A2, không cộng dồn A1', () => {
    expect(filterParams({ ...NO_FILTERS, cefr: 'A2' }, 'vi', '')).toEqual({
      locale: 'vi',
      cefr: 'A2',
      exact: true,
    })
  })

  it('gửi từ khoá tìm khi có', () => {
    expect(filterParams(NO_FILTERS, 'de', 'haus')).toEqual({ locale: 'de', q: 'haus' })
  })

  it('KHÔNG gửi mạo từ khi từ loại không phải danh từ — động từ không có dòng trong bảng nouns', () => {
    const params = filterParams({ ...NO_FILTERS, dtype: 'Verb', gender: 'DER' }, 'vi', '')
    expect(params).toEqual({ locale: 'vi', dtype: 'Verb' })
    expect(params.gender).toBeUndefined()
  })

  it('gửi mạo từ khi đang lọc danh từ', () => {
    expect(filterParams({ ...NO_FILTERS, dtype: 'Noun', gender: 'DIE' }, 'vi', '')).toEqual({
      locale: 'vi',
      dtype: 'Noun',
      gender: 'DIE',
    })
  })

  it('gộp mọi trục đang bật', () => {
    expect(filterParams({ status: 'NEW', dtype: 'Noun', gender: 'DAS', tag: 'Reise', cefr: 'B1' }, 'vi', 'zug')).toEqual(
      { locale: 'vi', q: 'zug', cefr: 'B1', exact: true, status: 'NEW', dtype: 'Noun', gender: 'DAS', tag: 'Reise' },
    )
  })
})

describe('toggleAxis', () => {
  it('bấm lần nữa vào chip đang chọn thì bỏ chọn', () => {
    const on = toggleAxis(NO_FILTERS, 'status', 'NEW')
    expect(on.status).toBe('NEW')
    expect(toggleAxis(on, 'status', 'NEW').status).toBeNull()
  })

  it('đổi sang giá trị khác trên cùng trục thì thay chứ không cộng dồn', () => {
    const learning = toggleAxis(toggleAxis(NO_FILTERS, 'status', 'NEW'), 'status', 'LEARNING')
    expect(learning.status).toBe('LEARNING')
  })

  it('bỏ chọn danh từ thì bỏ luôn mạo từ — nếu không, còn lại bộ lọc mồ côi trả về rỗng', () => {
    const noun = toggleAxis(NO_FILTERS, 'dtype', 'Noun')
    const withGender = toggleAxis(noun, 'gender', 'DER')
    expect(withGender.gender).toBe('DER')

    const off = toggleAxis(withGender, 'dtype', 'Noun')
    expect(off.dtype).toBeNull()
    expect(off.gender).toBeNull()
  })

  it('đổi từ danh từ sang động từ cũng bỏ mạo từ', () => {
    const nounDer = toggleAxis(toggleAxis(NO_FILTERS, 'dtype', 'Noun'), 'gender', 'DAS')
    const verb = toggleAxis(nounDer, 'dtype', 'Verb')
    expect(verb.dtype).toBe('Verb')
    expect(verb.gender).toBeNull()
  })

  it('không đụng tới các trục khác', () => {
    const base = toggleAxis(toggleAxis(NO_FILTERS, 'tag', 'Reise'), 'cefr', 'A1')
    const next = toggleAxis(base, 'status', 'MASTERED')
    expect(next.tag).toBe('Reise')
    expect(next.cefr).toBe('A1')
  })
})

describe('hasAnyFilter', () => {
  it('rỗng khi chưa lọc gì', () => {
    expect(hasAnyFilter(NO_FILTERS)).toBe(false)
  })

  it('đúng khi bất kỳ trục nào đang bật', () => {
    expect(hasAnyFilter({ ...NO_FILTERS, tag: 'Essen' })).toBe(true)
    expect(hasAnyFilter({ ...NO_FILTERS, cefr: 'A1' })).toBe(true)
  })
})

describe('genderChipColor', () => {
  it('trả đúng mã màu giống của sản phẩm — der xanh · die đỏ · das lục', () => {
    expect(genderChipColor('DER')).toBe('#2F6FC9')
    expect(genderChipColor('DIE')).toBe('#DA291C')
    expect(genderChipColor('DAS')).toBe('#1E9E61')
  })

  it('không tô màu cho giá trị lạ', () => {
    expect(genderChipColor('XXX')).toBeNull()
  })
})
