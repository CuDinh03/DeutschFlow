import { flattenStyle, insetPadding } from '../screenInset'

const I = { top: 59, bottom: 34, left: 0, right: 0 }

describe('insetPadding', () => {
  it('cộng đệm trên của màn vào inset — nút back không chui dưới thanh trạng thái', () => {
    // Chứng nhận, Tôi và cài đặt…: `contentStyle={{ paddingHorizontal: 20, paddingTop: 8 }}`
    expect(insetPadding(['top'], I, { paddingHorizontal: 20, paddingTop: 8 })).toEqual({ paddingTop: 67 })
  })

  it('không có đệm riêng thì chỉ là inset', () => {
    expect(insetPadding(['top', 'bottom'], I, undefined)).toEqual({ paddingTop: 59, paddingBottom: 34 })
  })

  it('lấy theo thứ tự paddingTop → paddingVertical → padding', () => {
    expect(insetPadding(['top'], I, { padding: 4 })).toEqual({ paddingTop: 63 })
    expect(insetPadding(['top'], I, { padding: 4, paddingVertical: 6 })).toEqual({ paddingTop: 65 })
    expect(insetPadding(['top'], I, { padding: 4, paddingVertical: 6, paddingTop: 10 })).toEqual({ paddingTop: 69 })
  })

  it('không ghi cạnh không chọn (màn edges=[] giữ paddingHorizontal của mình)', () => {
    expect(insetPadding([], I, { paddingHorizontal: 20 })).toEqual({})
    expect(insetPadding(['top'], { ...I, left: 44 }, { paddingHorizontal: 20 })).toEqual({ paddingTop: 59 })
  })

  it('cạnh trái/phải cộng paddingHorizontal', () => {
    expect(insetPadding(['left', 'right'], { ...I, left: 44, right: 44 }, { paddingHorizontal: 20 })).toEqual({ paddingLeft: 64, paddingRight: 64 })
  })

  it('đệm không phải số (phần trăm) thì chỉ giữ inset', () => {
    expect(insetPadding(['top'], I, { paddingTop: '5%' })).toEqual({ paddingTop: 59 })
  })

  it('đọc được style dạng mảng lồng, phần sau đè phần trước, bỏ giá trị rỗng', () => {
    expect(insetPadding(['top'], I, [{ paddingTop: 8 }, null, false, [{ paddingTop: 12 }]])).toEqual({ paddingTop: 71 })
  })
})

describe('flattenStyle', () => {
  it('gộp mảng như StyleSheet.flatten', () => {
    expect(flattenStyle([{ a: 1, b: 1 }, [{ b: 2 }, undefined]])).toEqual({ a: 1, b: 2 })
    expect(flattenStyle(null)).toEqual({})
  })
})
