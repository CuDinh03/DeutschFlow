import {
  formatCountdown,
  isVerificationDisabled,
  markSignupVerified,
  resendSecondsLeft,
  resetSignupVerified,
  sanitizePin,
  splitAtMarker,
  startFailureKey,
  verifyFailure,
  wasSignupVerified,
} from '../lib/registrationPin'

/** Màn `app/(auth)/verify-email.tsx` (thiết kế mã PIN 05/11 §7.2, §10 "Mobile"). */
describe('registrationPin', () => {
  it('dán mã: chỉ giữ chữ số, cắt đúng 6', () => {
    expect(sanitizePin('12 34 56')).toBe('123456')
    expect(sanitizePin('Mã của bạn: 004512.')).toBe('004512')
    expect(sanitizePin('1234567890')).toBe('123456')
    expect(sanitizePin('abc')).toBe('')
  })

  it('đếm ngược gửi lại: làm tròn lên, không âm', () => {
    const sent = 1_000_000
    expect(resendSecondsLeft(sent, 60, sent)).toBe(60)
    expect(resendSecondsLeft(sent, 60, sent + 59_001)).toBe(1)
    expect(resendSecondsLeft(sent, 60, sent + 60_000)).toBe(0)
    expect(resendSecondsLeft(sent, 60, sent + 999_999)).toBe(0)
  })

  it('đồng hồ gửi lại kiểu mẫu v3.4: phút:giây, giây hai chữ số', () => {
    expect(formatCountdown(42)).toBe('0:42')
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(5)).toBe('0:05')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-3)).toBe('0:00')
    expect(formatCountdown(Number.NaN)).toBe('0:00')
    expect(formatCountdown(41.2)).toBe('0:42')
  })

  it('tách câu dẫn quanh email để in đậm, không cắt bản dịch', () => {
    const mark = '\u2063'
    expect(splitAtMarker(`Mã đã gửi tới ${mark}. Mã có hiệu lực.`, mark)).toEqual({
      before: 'Mã đã gửi tới ',
      after: '. Mã có hiệu lực.',
      found: true,
    })
    // Tiếng Đức: email nằm giữa câu, động từ đứng sau.
    expect(splitAtMarker(`Wir haben einen Code an ${mark} gesendet.`, mark)).toEqual({
      before: 'Wir haben einen Code an ',
      after: ' gesendet.',
      found: true,
    })
    expect(splitAtMarker('Không có chỗ email.', mark)).toEqual({ before: 'Không có chỗ email.', after: '', found: false })
    expect(splitAtMarker('abc', '')).toEqual({ before: 'abc', after: '', found: false })
  })

  it('400 verify: chọn câu theo reason, không hiện mã máy', () => {
    const err = (status: number, extensions?: object) => ({ response: { status, data: { extensions } } })
    expect(verifyFailure(err(400, { reason: 'INVALID_CODE', remainingAttempts: 2 }))).toEqual({
      key: 'verify.wrongWithRemaining',
      remaining: 2,
    })
    expect(verifyFailure(err(400, { reason: 'INVALID_CODE' }))).toEqual({ key: 'verify.wrong' })
    expect(verifyFailure(err(400, { reason: 'LOCKED' }))).toEqual({ key: 'verify.locked' })
    expect(verifyFailure(err(400, { reason: 'EXPIRED' }))).toEqual({ key: 'verify.expired' })
    expect(verifyFailure(err(409, { reason: 'ACCOUNT_EXISTS' }))).toEqual({ key: 'verify.accountExists' })
    expect(verifyFailure(err(429))).toEqual({ key: 'verify.tooMany' })
    expect(verifyFailure(new Error('Network Error'))).toEqual({ key: 'verify.network' })
  })

  it('start: 501/401/404 = rơi về đường cũ; 503 = chưa gửi được thư; 429 = quá nhanh', () => {
    expect(isVerificationDisabled({ response: { status: 501 } })).toBe(true)
    expect(isVerificationDisabled({ response: { status: 401 } })).toBe(true)
    expect(isVerificationDisabled({ response: { status: 404 } })).toBe(true)
    expect(isVerificationDisabled({ response: { status: 400 } })).toBe(false)
    expect(isVerificationDisabled({ response: { status: 503 } })).toBe(false)
    expect(isVerificationDisabled(new Error('x'))).toBe(false)
    expect(startFailureKey({ response: { status: 503 } })).toBe('verify.sendFailed')
    expect(startFailureKey({ response: { status: 429 } })).toBe('verify.tooMany')
    expect(startFailureKey({ response: { status: 400 } })).toBeNull()
  })

  it('cờ "đã xác minh" chỉ bật khi xác minh xong, và reset được', () => {
    resetSignupVerified()
    expect(wasSignupVerified()).toBe(false)
    markSignupVerified()
    expect(wasSignupVerified()).toBe(true)
    resetSignupVerified()
    expect(wasSignupVerified()).toBe(false)
  })
})
