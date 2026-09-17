/**
 * Band luyện tập theo trình độ hồ sơ (owner báo 17/09/2026: A0 vẫn thấy nội dung B1 trên app).
 * Luật gương backend SpeakingCefrSupport.floorPracticeBand + web weekly normCurrent.
 */
import { DEFAULT_BAND, pickBand, practiceBand } from '@/lib/learnerBand'

describe('practiceBand', () => {
  test('A0 (mới bắt đầu) và thiếu hồ sơ → A1, không bao giờ là B1', () => {
    expect(practiceBand('A0')).toBe('A1')
    expect(practiceBand(null)).toBe('A1')
    expect(practiceBand(undefined)).toBe('A1')
    expect(practiceBand('')).toBe('A1')
    expect(DEFAULT_BAND).toBe('A1')
  })

  test('giữ nguyên trình độ đã khai, chuẩn hoá hoa/thường và khoảng trắng', () => {
    expect(practiceBand('A2')).toBe('A2')
    expect(practiceBand(' b1 ')).toBe('B1')
    expect(practiceBand('B2')).toBe('B2')
  })

  test('giá trị lạ → A1 (an toàn, không đẩy lên cao)', () => {
    expect(practiceBand('X9')).toBe('A1')
    expect(practiceBand('NATIVE')).toBe('A1')
  })
})

describe('pickBand', () => {
  const bands = ['A1', 'A2', 'B1', 'B2']

  test('A0 chọn A1 khi A1 có sẵn — không phải B1', () => {
    expect(pickBand('A0', bands)).toBe('A1')
    expect(pickBand(null, bands)).toBe('A1')
  })

  test('đúng band của trình độ khi có sẵn', () => {
    expect(pickBand('A2', bands)).toBe('A2')
    expect(pickBand('B1', bands)).toBe('B1')
  })

  test('không có đúng band → band cao nhất còn THẤP HƠN, không đẩy lên trên', () => {
    expect(pickBand('B1', ['A1', 'A2', 'B2'])).toBe('A2')
    expect(pickBand('B2', ['A1', 'B1'])).toBe('B1')
  })

  test('dưới không có gì → band thấp nhất có sẵn (tuần chỉ ra đề B1 thì A0 vẫn có đề)', () => {
    expect(pickBand('A0', ['B1', 'B2'])).toBe('B1')
    expect(pickBand('A1', ['B2'])).toBe('B2')
  })

  test('giữ nguyên cách viết của server, so sánh không phân biệt hoa/thường', () => {
    expect(pickBand('a2', ['a1', 'a2', 'b1'])).toBe('a2')
  })

  test('danh sách rỗng hoặc chưa tải → null (màn chờ, không nháy band sai)', () => {
    expect(pickBand('A0', [])).toBeNull()
    expect(pickBand('A0', null)).toBeNull()
    expect(pickBand('A0', undefined)).toBeNull()
  })

  test('danh sách toàn nhãn lạ → phần tử đầu', () => {
    expect(pickBand('A0', ['PRO', 'MAX'])).toBe('PRO')
  })
})
