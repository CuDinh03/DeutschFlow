import { describe, it, expect } from 'vitest'
import { mfaErrorKind, mfaRetryAfterSeconds, mfaWaitParts } from '@/lib/mfaApi'

/** Hợp đồng lỗi 2FA (25/11/2026): mã vừa dùng có loại riêng; 429 mang số giây còn lại theo cửa sổ trượt. */
function err(status: number, data: unknown, headers: Record<string, string> = {}) {
  return { isAxiosError: true, message: 'x', response: { status, data, headers } }
}

describe('mfaApi — phân loại lỗi + thời gian chờ', () => {
  it('MFA_CODE_ALREADY_USED → codeAlreadyUsed (khác codeInvalid)', () => {
    expect(mfaErrorKind(err(400, { extensions: { code: 'MFA_CODE_ALREADY_USED' } }))).toBe('codeAlreadyUsed')
    expect(mfaErrorKind(err(400, { extensions: { code: 'MFA_CODE_INVALID' } }))).toBe('codeInvalid')
    expect(mfaErrorKind(err(429, { extensions: { code: 'RATE_LIMITED' } }))).toBe('rateLimited')
  })

  it('số giây chờ: ưu tiên body, rồi header Retry-After; không phải 429 → null', () => {
    expect(mfaRetryAfterSeconds(err(429, { extensions: { retryAfterSeconds: 312 } }, { 'retry-after': '900' }))).toBe(312)
    expect(mfaRetryAfterSeconds(err(429, {}, { 'retry-after': '45' }))).toBe(45)
    expect(mfaRetryAfterSeconds(err(429, {}, { 'retry-after': 'abc' }))).toBeNull()
    expect(mfaRetryAfterSeconds(err(400, { extensions: { retryAfterSeconds: 10 } }))).toBeNull()
    expect(mfaRetryAfterSeconds(new Error('x'))).toBeNull()
  })

  it('hiển thị: dưới 60 giây theo giây, còn lại làm tròn lên phút', () => {
    expect(mfaWaitParts(0.2)).toEqual({ unit: 'seconds', count: 1 })
    expect(mfaWaitParts(59)).toEqual({ unit: 'seconds', count: 59 })
    expect(mfaWaitParts(60)).toEqual({ unit: 'minutes', count: 1 })
    expect(mfaWaitParts(61)).toEqual({ unit: 'minutes', count: 2 })
    expect(mfaWaitParts(900)).toEqual({ unit: 'minutes', count: 15 })
  })
})
