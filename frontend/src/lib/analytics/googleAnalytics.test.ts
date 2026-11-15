import { describe, expect, it } from 'vitest'
import { isGaHost, isGaTrackedPath } from './googleAnalytics'

describe('isGaTrackedPath', () => {
  it('đo trang chủ và các trang công khai (kể cả trang con, có/không dấu / cuối)', () => {
    for (const p of ['/', '/luyen-thi/', '/luyen-thi/telc-b1/', '/phong-van/dieu-duong', '/cam-nang/abc/', '/chi-phi', '/privacy/']) {
      expect(isGaTrackedPath(p), p).toBe(true)
    }
  })

  it('không đo trong app, thanh toán, đăng nhập và trang chia sẻ có token', () => {
    for (const p of [
      '/v2/student/dashboard',
      '/v2/login',
      '/v2/activate',
      '/payment/result',
      '/phieu/abc123',
      '/report/abc123',
      '/certificate/abc123',
      '/login',
      '/onboarding',
    ]) {
      expect(isGaTrackedPath(p), p).toBe(false)
    }
  })

  it('không nhận nhầm tiền tố dính chữ (/termsxyz, /about-us-secret)', () => {
    expect(isGaTrackedPath('/termsxyz')).toBe(false)
    expect(isGaTrackedPath('/about-us-secret')).toBe(false)
  })
})

describe('isGaHost', () => {
  it('chỉ tên miền thật', () => {
    expect(isGaHost('mydeutschflow.com')).toBe(true)
    expect(isGaHost('www.mydeutschflow.com')).toBe(true)
    expect(isGaHost('localhost')).toBe(false)
    expect(isGaHost('staging.mydeutschflow.com')).toBe(false)
  })
})
