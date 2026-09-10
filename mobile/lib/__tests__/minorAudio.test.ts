// Hợp đồng 403 MINOR_AUDIO_BLOCKED (DEC-22, D8 10/09): client bắt theo `extensions.code`, chọn
// thông điệp theo `reason`, dùng `detail` của server làm nội dung chính; mọi lỗi khác (quota 429,
// 403 thiếu quyền thường, mất mạng) KHÔNG được nhận nhầm — nếu nhận nhầm, học viên hết hạn mức sẽ
// được bảo "liên hệ trung tâm lấy phiếu đồng ý".

import {
  MINOR_AUDIO_BLOCKED_CODE,
  minorAudioBlockedFromProblem,
  minorAudioCopy,
  parseMinorAudioBlocked,
  presentMinorAudioBlocked,
  registerMinorAudioBlockedPresenter,
  type MinorAudioBlockedReason,
} from '@/lib/minorAudio'

const problem = (reason: string, detail: string | null = 'Câu của server.') => ({
  response: {
    status: 403,
    data: {
      type: 'https://deutschflow.app/errors/minor-audio-blocked',
      title: 'Forbidden',
      status: 403,
      detail,
      instance: '/api/ai-speaking/transcribe',
      extensions: { code: MINOR_AUDIO_BLOCKED_CODE, reason },
    },
  },
})

describe('parseMinorAudioBlocked — nhận diện đúng mã', () => {
  test.each<MinorAudioBlockedReason>([
    'BIRTH_DATE_REQUIRED',
    'GUARDIAN_CONSENT_REQUIRED',
    'GUARDIAN_CONSENT_REVOKED',
  ])('%s → { reason, detail } với detail của server', (reason) => {
    expect(parseMinorAudioBlocked(problem(reason))).toEqual({ reason, detail: 'Câu của server.' })
  })

  test('detail rỗng/thiếu → null (client dùng câu dự phòng)', () => {
    expect(parseMinorAudioBlocked(problem('GUARDIAN_CONSENT_REQUIRED', '   '))?.detail).toBeNull()
    expect(parseMinorAudioBlocked(problem('GUARDIAN_CONSENT_REQUIRED', null))?.detail).toBeNull()
  })

  test('reason lạ vẫn là mã này → chặn với tiêu đề "cần đồng ý", không rơi về Alert chung', () => {
    expect(parseMinorAudioBlocked(problem('SOMETHING_NEW'))).toEqual({
      reason: 'GUARDIAN_CONSENT_REQUIRED',
      detail: 'Câu của server.',
    })
  })

  test('thiếu extensions nhưng type kết thúc minor-audio-blocked → vẫn nhận (dây bảo hiểm)', () => {
    const e = {
      response: {
        status: 403,
        data: { type: 'https://x/minor-audio-blocked', detail: 'Chặn.' },
      },
    }
    expect(parseMinorAudioBlocked(e)).toEqual({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Chặn.' })
  })
})

describe('parseMinorAudioBlocked — KHÔNG nhận nhầm lỗi khác', () => {
  test('429 quota (QUOTA_EXCEEDED) → null', () => {
    const e = {
      response: {
        status: 429,
        data: { type: 'https://x/quota-exceeded', detail: 'Hết lượt AI.', extensions: { code: 'QUOTA_EXCEEDED' } },
      },
    }
    expect(parseMinorAudioBlocked(e)).toBeNull()
  })

  test('403 thiếu quyền thường (không có code) → null', () => {
    const e = { response: { status: 403, data: { type: 'https://x/forbidden', detail: 'Không có quyền.' } } }
    expect(parseMinorAudioBlocked(e)).toBeNull()
  })

  test('403 ORG_READ_ONLY (cùng status, code khác) → null', () => {
    const e = {
      response: { status: 403, data: { type: 'https://x/org-read-only', extensions: { code: 'ORG_READ_ONLY', reason: 'SUSPENDED' } } },
    }
    expect(parseMinorAudioBlocked(e)).toBeNull()
  })

  test('mất mạng (không response), Error thường, null → null', () => {
    expect(parseMinorAudioBlocked({ message: 'Network Error' })).toBeNull()
    expect(parseMinorAudioBlocked(new Error('boom'))).toBeNull()
    expect(parseMinorAudioBlocked(null)).toBeNull()
    expect(parseMinorAudioBlocked(undefined)).toBeNull()
  })

  test('minorAudioBlockedFromProblem: body không phải object → null', () => {
    expect(minorAudioBlockedFromProblem('gateway junk')).toBeNull()
    expect(minorAudioBlockedFromProblem(null)).toBeNull()
  })
})

describe('minorAudioCopy — ba lý do là ba việc cần làm khác nhau', () => {
  test('BIRTH_DATE_REQUIRED nói về ngày sinh; detail server là nội dung chính', () => {
    const copy = minorAudioCopy({ reason: 'BIRTH_DATE_REQUIRED', detail: 'Server nói.' })
    expect(copy.title).toMatch(/ngày sinh/)
    expect(copy.body).toBe('Server nói.')
  })

  test('GUARDIAN_CONSENT_REQUIRED không có detail → câu dự phòng nhắc phiếu đồng ý + mở lại ngay', () => {
    const copy = minorAudioCopy({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null })
    expect(copy.title).toMatch(/đồng ý/)
    expect(copy.body).toMatch(/liên hệ trung tâm/i)
    expect(copy.body).toMatch(/mở lại ngay/)
  })

  test('GUARDIAN_CONSENT_REVOKED: người giám hộ cấp lại — KHÔNG phải lời mời đồng ý lại trong app', () => {
    const copy = minorAudioCopy({ reason: 'GUARDIAN_CONSENT_REVOKED', detail: null })
    expect(copy.title).toMatch(/thu hồi/)
    expect(copy.body).toMatch(/người giám hộ liên hệ trung tâm/)
    expect(copy.body).not.toMatch(/nâng cấp/i)
  })

  test('ghi chú luôn nói rõ nâng gói không mở được', () => {
    expect(minorAudioCopy({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null }).note).toMatch(/Nâng cấp gói không mở được/)
  })
})

describe('presentMinorAudioBlocked — cầu nối tới host', () => {
  afterEach(() => registerMinorAudioBlockedPresenter(null))

  test('đúng mã + có host → gọi presenter với info, mặc định contact=true, trả true', () => {
    const presenter = jest.fn()
    registerMinorAudioBlockedPresenter(presenter)
    expect(presentMinorAudioBlocked(problem('GUARDIAN_CONSENT_REVOKED'))).toBe(true)
    expect(presenter).toHaveBeenCalledWith(
      { reason: 'GUARDIAN_CONSENT_REVOKED', detail: 'Câu của server.' },
      { contact: true },
    )
  })

  test('contact:false được chuyển tới host (màn onboarding không rời được)', () => {
    const presenter = jest.fn()
    registerMinorAudioBlockedPresenter(presenter)
    presentMinorAudioBlocked(problem('BIRTH_DATE_REQUIRED'), { contact: false })
    expect(presenter).toHaveBeenCalledWith(expect.anything(), { contact: false })
  })

  test('không phải mã này → false, presenter không được gọi', () => {
    const presenter = jest.fn()
    registerMinorAudioBlockedPresenter(presenter)
    expect(presentMinorAudioBlocked({ response: { status: 429, data: { extensions: { code: 'QUOTA_EXCEEDED' } } } })).toBe(false)
    expect(presenter).not.toHaveBeenCalled()
  })

  test('chưa có host → false (caller rơi về Alert cũ, Alert vẫn đọc detail server)', () => {
    expect(presentMinorAudioBlocked(problem('GUARDIAN_CONSENT_REQUIRED'))).toBe(false)
  })
})
