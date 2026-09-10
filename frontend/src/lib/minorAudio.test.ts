import { describe, expect, it } from 'vitest'
import {
  MINOR_AUDIO_BLOCKED_CODE,
  minorAudioBlockedFromProblem,
  parseMinorAudioBlocked,
  type MinorAudioBlockedReason,
} from './minorAudio'

// Hợp đồng 403 MINOR_AUDIO_BLOCKED (DEC-22, D8 10/09): bắt theo `extensions.code`, chọn thông
// điệp theo `reason`, dùng `detail` server làm nội dung chính; lỗi khác (429 quota, 403 thiếu quyền
// thường, ORG_READ_ONLY, mất mạng) KHÔNG được nhận nhầm — nhận nhầm là bảo học viên hết hạn mức
// "đi xin phiếu đồng ý".

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
  it.each<MinorAudioBlockedReason>([
    'BIRTH_DATE_REQUIRED',
    'GUARDIAN_CONSENT_REQUIRED',
    'GUARDIAN_CONSENT_REVOKED',
  ])('%s → { reason, detail } với detail của server', (reason) => {
    expect(parseMinorAudioBlocked(problem(reason))).toEqual({ reason, detail: 'Câu của server.' })
  })

  it('detail rỗng/thiếu → null (component dùng câu i18n dự phòng)', () => {
    expect(parseMinorAudioBlocked(problem('GUARDIAN_CONSENT_REQUIRED', '  '))?.detail).toBeNull()
    expect(parseMinorAudioBlocked(problem('GUARDIAN_CONSENT_REQUIRED', null))?.detail).toBeNull()
  })

  it('reason lạ vẫn là mã này → chặn với nhánh "cần đồng ý", không rơi về lỗi chung', () => {
    expect(parseMinorAudioBlocked(problem('SOMETHING_NEW'))).toEqual({
      reason: 'GUARDIAN_CONSENT_REQUIRED',
      detail: 'Câu của server.',
    })
  })

  it('thiếu extensions nhưng type kết thúc minor-audio-blocked → vẫn nhận (dây bảo hiểm)', () => {
    const e = { response: { status: 403, data: { type: 'https://x/minor-audio-blocked', detail: 'Chặn.' } } }
    expect(parseMinorAudioBlocked(e)).toEqual({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Chặn.' })
  })
})

describe('parseMinorAudioBlocked — KHÔNG nhận nhầm lỗi khác', () => {
  it('429 QUOTA_EXCEEDED → null', () => {
    const e = {
      response: {
        status: 429,
        data: { type: 'https://x/quota-exceeded', detail: 'Hết lượt AI.', extensions: { code: 'QUOTA_EXCEEDED' } },
      },
    }
    expect(parseMinorAudioBlocked(e)).toBeNull()
  })

  it('403 thiếu quyền thường (không code) và 403 ORG_READ_ONLY → null', () => {
    expect(parseMinorAudioBlocked({ response: { status: 403, data: { type: 'https://x/forbidden', detail: 'Không có quyền.' } } })).toBeNull()
    expect(
      parseMinorAudioBlocked({
        response: { status: 403, data: { type: 'https://x/org-read-only', extensions: { code: 'ORG_READ_ONLY', reason: 'SUSPENDED' } } },
      }),
    ).toBeNull()
  })

  it('mất mạng (không response), Error thường, null/undefined → null', () => {
    expect(parseMinorAudioBlocked({ message: 'Network Error' })).toBeNull()
    expect(parseMinorAudioBlocked(new Error('boom'))).toBeNull()
    expect(parseMinorAudioBlocked(null)).toBeNull()
    expect(parseMinorAudioBlocked(undefined)).toBeNull()
  })
})

describe('minorAudioBlockedFromProblem — body fetch trần (PronunciationFeedback)', () => {
  it('body problem+json đúng mã → info', () => {
    expect(
      minorAudioBlockedFromProblem({ detail: 'Chặn.', extensions: { code: MINOR_AUDIO_BLOCKED_CODE, reason: 'GUARDIAN_CONSENT_REVOKED' } }),
    ).toEqual({ reason: 'GUARDIAN_CONSENT_REVOKED', detail: 'Chặn.' })
  })

  it('body không phải object / body lạ → null', () => {
    expect(minorAudioBlockedFromProblem('gateway junk')).toBeNull()
    expect(minorAudioBlockedFromProblem(null)).toBeNull()
    expect(minorAudioBlockedFromProblem({ detail: 'x' })).toBeNull()
  })
})
