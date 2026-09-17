// handleAiError là cửa chung của lỗi AI trên mobile: 403 MINOR_AUDIO_BLOCKED phải đi ra sheet giải
// thích (qua presenter), KHÔNG rơi vào Alert chung, và càng không được nhận nhầm thành quota để
// mời một đứa trẻ nâng gói. Các lỗi khác giữ nguyên luồng cũ.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {},
  apiMessage: () => 'Câu lỗi chung',
}))

// Store gói: giữ `isTrialActive` THẬT (selector thuần, M-8 gate trên nó), chỉ thay `getState` để
// từng test đặt `plan` mình muốn.
const mockPlanState: { plan: unknown; fetchPlan: () => Promise<void> } = { plan: null, fetchPlan: async () => {} }
jest.mock('@/stores/usePlanStore', () => ({
  ...jest.requireActual('@/stores/usePlanStore'),
  usePlanStore: { getState: () => mockPlanState },
}))

// Cờ paywall đọc qua getter để test bật/tắt được mà không phải isolateModules.
const mockPaywall = { PAYWALL_ENABLED: false, PRO_UNLOCKED_FREE: false }
jest.mock('@/lib/paywall', () => ({
  get PAYWALL_ENABLED() { return mockPaywall.PAYWALL_ENABLED },
  get PRO_UNLOCKED_FREE() { return mockPaywall.PRO_UNLOCKED_FREE },
}))

import { Alert } from 'react-native'
import { handleAiError, TRIAL_QUOTA_MESSAGE } from '@/lib/upsell'
import { MINOR_AUDIO_BLOCKED_CODE, registerMinorAudioBlockedPresenter } from '@/lib/minorAudio'

const minorError = (reason: string) => ({
  response: {
    status: 403,
    data: { detail: 'Server nói.', extensions: { code: MINOR_AUDIO_BLOCKED_CODE, reason } },
  },
})

let alertSpy: jest.SpyInstance

beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  alertSpy.mockRestore()
  registerMinorAudioBlockedPresenter(null)
  mockPlanState.plan = null
  mockPaywall.PAYWALL_ENABLED = false
  mockPaywall.PRO_UNLOCKED_FREE = false
})

test('MINOR_AUDIO_BLOCKED → presenter nhận đúng reason + detail; không Alert', () => {
  const presenter = jest.fn()
  registerMinorAudioBlockedPresenter(presenter)

  handleAiError(minorError('GUARDIAN_CONSENT_REQUIRED'), 'Không thể tiếp tục')

  expect(presenter).toHaveBeenCalledWith(
    { reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Server nói.', contact: 'CENTER' },
    { contact: true },
  )
  expect(alertSpy).not.toHaveBeenCalled()
})

test('quota 429 vẫn đi đường cũ ("Hết lượt AI"), presenter không được gọi', () => {
  const presenter = jest.fn()
  registerMinorAudioBlockedPresenter(presenter)

  handleAiError({
    response: { status: 429, data: { type: 'https://x/quota-exceeded', detail: 'Hết hạn mức AI.' } },
  })

  expect(presenter).not.toHaveBeenCalled()
  expect(alertSpy).toHaveBeenCalledWith('Hết lượt AI', 'Hết hạn mức AI.', expect.any(Array))
})

test('lỗi thường → Alert chung với tiêu đề caller đưa', () => {
  handleAiError(new Error('boom'), 'Không thể bắt đầu')
  expect(alertSpy).toHaveBeenCalledWith('Không thể bắt đầu', 'Câu lỗi chung')
})

test('chưa có host → rơi về Alert chung (Alert vẫn đọc detail server qua apiMessage)', () => {
  handleAiError(minorError('BIRTH_DATE_REQUIRED'))
  expect(alertSpy).toHaveBeenCalledWith('Lỗi', 'Câu lỗi chung')
})

// ── M-8 (Đợt 0 onboarding 17/09, Q1 28/08): hết lượt GIỮA thời gian dùng thử ─────────────────
// Lượt AI hồi lại ngày mai — nói đúng vậy, một nút "Đã hiểu", KHÔNG "Nâng cấp" dù paywall đang bật.
describe('hết lượt AI khi đang dùng thử (M-8)', () => {
  const inTrial = () => ({ isTrial: true, trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })
  const dailyQuota = { response: { status: 429, data: { type: 'https://x/quota-exceeded', detail: 'AI token quota exceeded.' } } }
  const trialExpired = {
    response: { status: 429, data: { type: 'https://x/quota-exceeded', detail: 'Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.' } },
  }

  test('đang thử + hết lượt ngày → "mai có lại", chỉ một nút "Đã hiểu", không "Nâng cấp"', () => {
    mockPlanState.plan = inTrial()
    mockPaywall.PAYWALL_ENABLED = true

    handleAiError(dailyQuota)

    expect(alertSpy).toHaveBeenCalledTimes(1)
    const [title, message, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string }[]]
    expect(title).toBe('Hết lượt AI hôm nay')
    expect(message).toBe(TRIAL_QUOTA_MESSAGE)
    expect(message).toMatch(/Ngày mai bạn có lượt mới/)
    expect(buttons.map((b) => b.text)).toEqual(['Đã hiểu'])
  })

  test('client tưởng còn thử nhưng server nói trial ĐÃ HẾT → giữ đường nâng cấp cũ', () => {
    mockPlanState.plan = inTrial()
    mockPaywall.PAYWALL_ENABLED = true

    handleAiError(trialExpired)

    const [title, message, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string }[]]
    expect(title).toBe('Hết lượt AI')
    expect(message).toMatch(/nâng cấp/i)
    expect(buttons.map((b) => b.text)).toEqual(['Để sau', 'Nâng cấp'])
  })

  test('trial đã qua mốc trên máy → đường cũ (có "Nâng cấp" khi paywall bật)', () => {
    mockPlanState.plan = { isTrial: true, trialEndsAt: '2000-01-01T00:00:00.000Z' }
    mockPaywall.PAYWALL_ENABLED = true

    handleAiError(dailyQuota)

    const [title, , buttons] = alertSpy.mock.calls[0] as [string, string, { text: string }[]]
    expect(title).toBe('Hết lượt AI')
    expect(buttons.map((b) => b.text)).toEqual(['Để sau', 'Nâng cấp'])
  })

  test('không phải trial (đã trả tiền / FREE) → đường cũ, không đụng', () => {
    mockPlanState.plan = { isTrial: false, trialEndsAt: null, tier: 'FREE' }

    handleAiError(dailyQuota)

    expect(alertSpy).toHaveBeenCalledWith('Hết lượt AI', 'AI token quota exceeded.', expect.any(Array))
  })
})
