/**
 * `handleAiError` is the single choke-point that keeps the iOS free build App Store Guideline 3.1.1
 * safe: the backend still enforces the real AI quota, so a genuine post-trial free account can receive
 * a 429 whose server message says "…Hãy nâng cấp để tiếp tục." On iOS that steering text — and the
 * upgrade button — MUST be suppressed. These tests lock that behavior so a future refactor cannot
 * silently reintroduce the leak. See mobile/lib/upsell.ts + mobile/lib/paywall.ts.
 *
 * PRO_UNLOCKED_FREE / PAYWALL_ENABLED are computed from Platform.OS at module load, so each case
 * re-imports upsell inside `jest.isolateModules` after setting the platform on the fresh mock.
 */

// Side-effecting dependencies of handleAiError — kept inert so the test asserts only the
// message/button decision (the 3.1.1-relevant logic).
jest.mock('@/stores/usePlanStore', () => ({
  usePlanStore: { getState: () => ({ fetchPlan: (): Promise<void> => Promise.resolve() }) },
}))
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {},
  apiMessage: (e: unknown): string =>
    (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Đã xảy ra lỗi.',
}))

const ERR_BASE = 'https://deutschflow.com/errors/'

/** 429 whose body carries the 7-day-trial expiry message (the exact 3.1.1 steering text). */
const trialExpired429 = {
  isAxiosError: true,
  response: {
    status: 429,
    data: { type: `${ERR_BASE}quota-exceeded`, detail: 'Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.' },
  },
}

/** A non-quota failure — must keep the caller's generic alert untouched. */
const serverError500 = { isAxiosError: true, response: { status: 500, data: { detail: 'Máy chủ đang bận.' } } }

type Button = { text: string }
type AlertArgs = [string, string | undefined, Button[] | undefined]

/** Run handleAiError under a given platform and capture the single Alert.alert(...) call it makes. */
function captureAlert(os: 'ios' | 'android', error: unknown, fallbackTitle?: string): AlertArgs {
  let captured: AlertArgs | undefined
  jest.isolateModules(() => {
    const rn = require('react-native') as {
      Platform: { OS: string }
      Alert: { alert: (...args: unknown[]) => void }
    }
    rn.Platform.OS = os
    rn.Alert.alert = (...args: unknown[]) => {
      captured = args as AlertArgs
    }
    const { handleAiError } = require('@/lib/upsell') as typeof import('@/lib/upsell')
    if (fallbackTitle === undefined) handleAiError(error)
    else handleAiError(error, fallbackTitle)
  })
  if (!captured) throw new Error('Alert.alert was not called')
  return captured
}

describe('handleAiError — App Store 3.1.1 iOS neutralisation', () => {
  it('replaces a trial-expired / quota message with a neutral notice on iOS', () => {
    const [title, message] = captureAlert('ios', trialExpired429)

    expect(title).toBe('Hết lượt AI')
    expect(message).toBe('Bạn đã dùng hết lượt AI hôm nay, vui lòng thử lại sau.')
    // The server's "Hãy nâng cấp" steering text must never reach the iOS user.
    expect(message).not.toMatch(/nâng cấp/i)
  })

  it('offers NO upgrade button on iOS for a quota error', () => {
    const [, , buttons] = captureAlert('ios', trialExpired429)

    const labels = (buttons ?? []).map((b) => b.text)
    expect(labels).toEqual(['Để sau'])
    expect(labels).not.toContain('Nâng cấp')
  })

  it('keeps the caller’s generic alert (title + apiMessage, no buttons) for a non-quota error on iOS', () => {
    const [title, message, buttons] = captureAlert('ios', serverError500, 'Không xuất được')

    expect(title).toBe('Không xuất được')
    expect(message).toBe('Máy chủ đang bận.')
    expect(buttons).toBeUndefined()
  })

  it('DOES surface the upgrade path on Android for a quota error (gate is two-way)', () => {
    const [title, , buttons] = captureAlert('android', trialExpired429)

    expect(title).toBe('Hết lượt AI')
    const labels = (buttons ?? []).map((b) => b.text)
    expect(labels).toContain('Nâng cấp')
  })
})
