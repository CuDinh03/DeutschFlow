/**
 * Hồi quy 11/11/2026: 20/21 người bấm đăng nhập trên iOS trong 30 ngày nhận 400 (chưa có tài khoản)
 * nhưng PostHog chỉ ghi chuỗi axios thô, màn hình chỉ báo "sai email hoặc mật khẩu". Bộ test khoá
 * cách phân loại để thông báo và telemetry không trôi về chuỗi thô lần nữa.
 */
import { AxiosError, type AxiosResponse } from 'axios'
import { loginFailureKind } from '@/lib/loginFailure'

function httpError(status: number): AxiosError {
  const response = { status, data: {}, headers: {}, statusText: '', config: {} } as AxiosResponse
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined, response)
}

describe('loginFailureKind', () => {
  it('400 (email chưa có tài khoản hoặc sai mật khẩu) → credentials', () => {
    expect(loginFailureKind(httpError(400))).toBe('credentials')
    expect(loginFailureKind(httpError(401))).toBe('credentials')
  })

  it('429 → rate_limited', () => {
    expect(loginFailureKind(httpError(429))).toBe('rate_limited')
  })

  it('5xx → server', () => {
    expect(loginFailureKind(httpError(500))).toBe('server')
    expect(loginFailureKind(httpError(503))).toBe('server')
  })

  it('timeout không có response → timeout', () => {
    expect(loginFailureKind(new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED'))).toBe('timeout')
  })

  it('mất mạng không có response → network', () => {
    expect(loginFailureKind(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('network')
  })

  it('tài khoản không phải học viên → wrong_role', () => {
    expect(loginFailureKind(new Error('NON_STUDENT_ROLE'))).toBe('wrong_role')
  })

  it('lỗi lạ → unknown', () => {
    expect(loginFailureKind(new Error('boom'))).toBe('unknown')
    expect(loginFailureKind(null)).toBe('unknown')
  })
})
