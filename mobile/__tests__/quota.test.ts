import { isQuotaExceededError, isTrialExpiredError, quotaExceededMessage } from '@/lib/quota'

const BASE = 'https://deutschflow.com/errors/'

/** Shape of an axios error carrying an RFC-7807 ProblemDetail body. */
function axiosError(status: number, problem: Record<string, unknown>) {
  return { isAxiosError: true, response: { status, data: problem } }
}

const trialExpired = axiosError(429, {
  type: `${BASE}quota-exceeded`,
  title: 'Quota Exceeded',
  status: 429,
  detail: 'Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.',
})

const dailyExhausted = axiosError(429, {
  type: `${BASE}quota-exceeded`,
  detail: 'AI token quota exceeded.',
})

const rateLimited = axiosError(429, {
  type: `${BASE}rate-limit-exceeded`,
  detail: 'Too many requests.',
})

describe('isQuotaExceededError', () => {
  it('is true for a 429 quota-exceeded problem (trial expiry and daily exhaustion)', () => {
    expect(isQuotaExceededError(trialExpired)).toBe(true)
    expect(isQuotaExceededError(dailyExhausted)).toBe(true)
  })

  it('is false for a 429 rate-limit (must not trigger an upsell)', () => {
    expect(isQuotaExceededError(rateLimited)).toBe(false)
  })

  it('is false for other statuses and non-error inputs', () => {
    expect(isQuotaExceededError(axiosError(500, { type: `${BASE}quota-exceeded` }))).toBe(false)
    expect(isQuotaExceededError(axiosError(401, {}))).toBe(false)
    expect(isQuotaExceededError(new Error('network'))).toBe(false)
    expect(isQuotaExceededError(null)).toBe(false)
    expect(isQuotaExceededError(undefined)).toBe(false)
  })

  it('falls back to quota wording when the problem type is missing', () => {
    expect(isQuotaExceededError(axiosError(429, { detail: 'Gói dùng thử đã hết hạn.' }))).toBe(true)
    expect(isQuotaExceededError(axiosError(429, { detail: 'Some unrelated error' }))).toBe(false)
  })
})

describe('isTrialExpiredError', () => {
  it('distinguishes trial expiry from generic quota exhaustion', () => {
    expect(isTrialExpiredError(trialExpired)).toBe(true)
    expect(isTrialExpiredError(dailyExhausted)).toBe(false)
    expect(isTrialExpiredError(rateLimited)).toBe(false)
  })
})

describe('quotaExceededMessage', () => {
  it('returns the server detail message, or null when absent', () => {
    expect(quotaExceededMessage(trialExpired)).toBe('Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.')
    expect(quotaExceededMessage(axiosError(429, {}))).toBeNull()
    expect(quotaExceededMessage(new Error('x'))).toBeNull()
  })
})
