import { toIsoBirthDate } from '@/lib/profileApi'

/**
 * Ba ô số thay cho bộ chọn lịch (xem javadoc toIsoBirthDate) nên phép kiểm ngày nằm hoàn toàn ở
 * tầng này — không có widget nào chặn hộ ngày 31/02 hay năm 9999.
 */
describe('toIsoBirthDate', () => {
  it('ghép đúng chuỗi ISO và chèn số 0 đứng đầu', () => {
    expect(toIsoBirthDate('5', '3', '1996')).toEqual({ iso: '1996-03-05' })
  })

  it('đòi đủ cả ba ô', () => {
    expect(toIsoBirthDate('5', '', '1996')).toEqual({ error: 'Hãy nhập đủ ngày, tháng và năm.' })
  })

  it('bắt tháng ngoài 1–12', () => {
    expect(toIsoBirthDate('5', '13', '1996')).toEqual({ error: 'Tháng phải từ 1 đến 12.' })
  })

  it('bắt ngày không tồn tại trong tháng thay vì để Date tràn sang tháng sau', () => {
    // new Date(1996, 1, 31) tự thành 02/03 — nếu không so lại thì người dùng gõ 31/02 sẽ âm thầm
    // lưu thành 02/03.
    expect(toIsoBirthDate('31', '2', '1996')).toEqual({
      error: 'Ngày này không có trong tháng đã chọn.',
    })
  })

  it('chấp nhận 29/02 của năm nhuận', () => {
    expect(toIsoBirthDate('29', '2', '1996')).toEqual({ iso: '1996-02-29' })
  })

  it('từ chối năm ngoài khoảng hợp lý', () => {
    const nextYear = new Date().getFullYear() + 1
    expect(toIsoBirthDate('1', '1', String(nextYear))).toEqual({ error: 'Năm sinh không hợp lệ.' })
    expect(toIsoBirthDate('1', '1', '1800')).toEqual({ error: 'Năm sinh không hợp lệ.' })
  })

  it('từ chối ngày ở tương lai trong chính năm nay', () => {
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    // Chỉ chạy khi ngày mai vẫn trong năm nay — qua năm là đã bị chặn bởi phép kiểm năm ở trên.
    if (tomorrow.getFullYear() === today.getFullYear()) {
      expect(
        toIsoBirthDate(
          String(tomorrow.getDate()),
          String(tomorrow.getMonth() + 1),
          String(tomorrow.getFullYear())
        )
      ).toEqual({ error: 'Ngày sinh không thể ở tương lai.' })
    }
  })

  it('từ chối ký tự không phải số', () => {
    expect(toIsoBirthDate('ab', '3', '1996')).toEqual({ error: 'Ngày sinh chỉ gồm chữ số.' })
  })
})
