// handleAiError là cửa chung của lỗi AI trên mobile: 403 MINOR_AUDIO_BLOCKED phải đi ra sheet giải
// thích (qua presenter), KHÔNG rơi vào Alert chung, và càng không được nhận nhầm thành quota để
// mời một đứa trẻ nâng gói. Các lỗi khác giữ nguyên luồng cũ.

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {},
  apiMessage: () => 'Câu lỗi chung',
}))

jest.mock('@/stores/usePlanStore', () => ({
  usePlanStore: { getState: () => ({ fetchPlan: async () => {} }) },
}))

jest.mock('@/lib/paywall', () => ({ PAYWALL_ENABLED: false, PRO_UNLOCKED_FREE: false }))

import { Alert } from 'react-native'
import { handleAiError } from '@/lib/upsell'
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
})

test('MINOR_AUDIO_BLOCKED → presenter nhận đúng reason + detail; không Alert', () => {
  const presenter = jest.fn()
  registerMinorAudioBlockedPresenter(presenter)

  handleAiError(minorError('GUARDIAN_CONSENT_REQUIRED'), 'Không thể tiếp tục')

  expect(presenter).toHaveBeenCalledWith(
    { reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Server nói.' },
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
