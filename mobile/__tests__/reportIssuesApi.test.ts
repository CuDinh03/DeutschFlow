import {
  attendanceRateText,
  gradeLabel,
  periodLabel,
  scoreText,
  skillLabel,
  statusText,
} from '@/lib/reportIssuesApi'

describe('nhãn phiếu gửi gia đình', () => {
  it('gọi tên hai kỳ đúng như bản in và trang web', () => {
    expect(periodLabel('MIDTERM')).toBe('Kỳ giữa khoá')
    expect(periodLabel('FINAL')).toBe('Kỳ cuối khoá')
  })

  it('kỳ lạ hoặc thiếu vẫn ra một nhãn đọc được, không ra chuỗi rỗng', () => {
    expect(periodLabel(undefined)).toBe('Phiếu đánh giá')
    expect(periodLabel('QUARTER')).toBe('Phiếu đánh giá')
  })

  it('dịch bốn mã kỹ năng của backend', () => {
    expect(['HOREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'].map(skillLabel)).toEqual(['Nghe', 'Đọc', 'Viết', 'Nói'])
  })

  it('mã kỹ năng lạ hiện nguyên mã chứ không biến mất', () => {
    expect(skillLabel('UNKNOWN_SKILL')).toBe('UNKNOWN_SKILL')
  })

  it('xếp loại có nhãn tiếng Việt; thiếu thì trả null để không in gì', () => {
    expect(gradeLabel('EXCELLENT')).toBe('Xuất sắc')
    expect(gradeLabel('WEAK')).toBe('Yếu')
    expect(gradeLabel(null)).toBeNull()
  })

  // 🔴 SUPERSEDED phải nói "đã có bản mới", không phải "hết hiệu lực": nói sai ở đây khiến học viên
  // tưởng mình mất phiếu, trong khi giáo viên vừa phát hành lại bản mới hơn.
  it('bốn trạng thái nói đúng việc link của gia đình còn mở được không', () => {
    expect(statusText('ACTIVE')).toEqual({ label: 'Gia đình xem được', tone: 'ok' })
    expect(statusText('SUPERSEDED')).toEqual({ label: 'Đã có bản mới hơn', tone: 'muted' })
    expect(statusText('EXPIRED')).toEqual({ label: 'Link đã hết hạn', tone: 'muted' })
    expect(statusText('REVOKED')).toEqual({ label: 'Đã thu hồi', tone: 'warn' })
  })

  it('trạng thái lạ không làm đổ giao diện', () => {
    expect(statusText('SOMETHING_NEW').tone).toBe('muted')
  })

  // 🔴 Chưa điểm danh buổi nào ≠ chuyên cần 0 %. Backend trả ratePct = null đúng vì lý do đó;
  // nếu ở đây đổ về 0 thì học viên mới vào lớp thấy mình "vắng toàn bộ".
  it('không có buổi nào được ghi nhận ⇒ không hiện tỉ lệ, không hiện 0%', () => {
    expect(attendanceRateText({ present: 0, absent: 0, late: 0, recorded: 0, ratePct: null })).toBeNull()
    expect(attendanceRateText(null)).toBeNull()
    expect(attendanceRateText(undefined)).toBeNull()
  })

  it('có buổi ghi nhận thì hiện phần trăm', () => {
    expect(attendanceRateText({ present: 8, absent: 1, late: 1, recorded: 10, ratePct: 90 })).toBe('90%')
    expect(attendanceRateText({ recorded: 4, ratePct: 0 })).toBe('0%')
  })

  // Điểm 0 là một điểm thật, phải in ra 0 — chỉ null/thiếu mới thành gạch ngang.
  it('điểm thiếu ra gạch ngang, điểm 0 vẫn là 0', () => {
    expect(scoreText(null)).toBe('—')
    expect(scoreText(undefined)).toBe('—')
    expect(scoreText(0)).toBe('0')
    expect(scoreText(7.5)).toBe('7.5')
  })
})
