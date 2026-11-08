import { resetFailure, RESET_CODE_INVALID } from '../passwordReset'

describe('resetFailure — câu báo lỗi đặt lại mật khẩu', () => {
  it('mọi kiểu mã hỏng (RESET_CODE_INVALID) ⇒ một câu trung tính', () => {
    expect(resetFailure({ response: { status: 400, data: { extensions: { code: RESET_CODE_INVALID } } } })).toBe(
      'reset.wrongCode',
    )
  })

  it('429 ⇒ quá nhanh; mất mạng ⇒ network', () => {
    expect(resetFailure({ response: { status: 429 } })).toBe('reset.tooMany')
    expect(resetFailure({ isAxiosError: true, message: 'Network Error' })).toBe('reset.network')
    expect(resetFailure(new Error('boom'))).toBeNull()
  })

  it('lỗi khác (vd. 400 mật khẩu yếu) ⇒ null để apiMessage hiện câu của server', () => {
    expect(resetFailure({ response: { status: 400, data: { extensions: { code: 'PASSWORD_WEAK' } } } })).toBeNull()
    expect(resetFailure({ response: { status: 500 } })).toBeNull()
  })
})
