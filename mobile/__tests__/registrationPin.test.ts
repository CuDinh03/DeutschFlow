import {
  isVerificationDisabled,
  markSignupVerified,
  resendSecondsLeft,
  resetSignupVerified,
  sanitizePin,
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

  it('start: 501 = rơi về đường cũ; 503 = chưa gửi được thư; 429 = quá nhanh', () => {
    expect(isVerificationDisabled({ response: { status: 501 } })).toBe(true)
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
