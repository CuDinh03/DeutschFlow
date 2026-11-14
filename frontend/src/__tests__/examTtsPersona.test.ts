/**
 * Persona tường minh của bài nghe (14/11/2026 — mỗi nhân vật một giọng):
 *   1. Không truyền persona (phòng thi nói) ⇒ y như trước: ANNA/THOMAS, không hỏi danh sách persona.
 *   2. Sidecar có persona ⇒ gửi đúng persona đó; câu xin trước (prefetch) dùng cùng persona, không xin lại.
 *   3. Sidecar/backend cũ chưa có persona ⇒ đọc bằng persona cũ theo vai, KHÔNG rơi xuống giọng máy.
 *   4. Máy chủ từ chối persona mới ⇒ thử lại bằng persona cũ cho câu đó.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const apiMock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: apiMock }))

import { prepareExamLine, resetExamTtsPersonaSupport, speakExamLine } from '@/components/features/exam-speaking/examTts'

/** Audio giả: phát xong ngay. */
class InstantAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  duration = NaN
  src = ''
  preload = ''
  play() {
    queueMicrotask(() => this.onended?.())
    return Promise.resolve()
  }
  pause() {}
}

const NEW_SIDECAR = ['DEFAULT', 'ANNA', 'THOMAS', 'HOER_F1', 'HOER_F2', 'HOER_F3', 'HOER_M1', 'HOER_M2', 'HOER_M3']
const OLD_SIDECAR = ['DEFAULT', 'ANNA', 'THOMAS']
const audioBlob = () => ({ data: new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }) })
const sentPersonas = () => apiMock.post.mock.calls.map((c) => (c[1] as { persona: string }).persona)

beforeEach(() => {
  apiMock.post.mockReset()
  apiMock.get.mockReset()
  apiMock.post.mockResolvedValue(audioBlob())
  resetExamTtsPersonaSupport()
  vi.stubGlobal('Audio', InstantAudio)
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:test', revokeObjectURL: () => {} })
  // Không có giọng máy: nếu code rơi xuống Web Speech thì kết quả là 'failed' — test bắt được.
  vi.stubGlobal('speechSynthesis', { cancel: () => {}, getVoices: () => [], speak: () => {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('examTts — persona tường minh của bài nghe', () => {
  it('không truyền persona: ANNA/THOMAS như trước, không hỏi danh sách persona', async () => {
    expect(await speakExamLine('PRUEFER', 'Guten Tag.')).toBe('played')
    expect(await speakExamLine('PARTNER', 'Hallo.')).toBe('played')
    expect(sentPersonas()).toEqual(['ANNA', 'THOMAS'])
    expect(apiMock.get).not.toHaveBeenCalled()
  })

  it('sidecar có persona: gửi đúng persona; danh sách chỉ hỏi một lần', async () => {
    apiMock.get.mockResolvedValue({ data: { personas: NEW_SIDECAR } })
    expect(await speakExamLine('PARTNER', 'Ich fahre mit dem Rad.', 'HOER_M2')).toBe('played')
    expect(await speakExamLine('PRUEFER', 'Nummer 41.', 'HOER_F3')).toBe('played')
    expect(sentPersonas()).toEqual(['HOER_M2', 'HOER_F3'])
    expect(apiMock.get).toHaveBeenCalledTimes(1)
    expect(apiMock.get.mock.calls[0][0]).toBe('/ai-speaking/tts/personas')
  })

  it('câu xin trước dùng cùng persona và được dùng lại; khác persona thì không dùng lẫn audio', async () => {
    apiMock.get.mockResolvedValue({ data: { personas: NEW_SIDECAR } })
    prepareExamLine('PARTNER', 'Eigentlich war es ein Zufall.', 'HOER_M2')
    expect(await speakExamLine('PARTNER', 'Eigentlich war es ein Zufall.', 'HOER_M2')).toBe('played')
    expect(sentPersonas()).toEqual(['HOER_M2'])

    // Cùng câu, cùng vai nhưng giọng khác (hoặc không persona) ⇒ phải xin audio riêng.
    prepareExamLine('PARTNER', 'Eigentlich war es ein Zufall.', 'HOER_M2')
    expect(await speakExamLine('PARTNER', 'Eigentlich war es ein Zufall.', 'HOER_M3')).toBe('played')
    expect(await speakExamLine('PARTNER', 'Eigentlich war es ein Zufall.')).toBe('played')
    expect(sentPersonas()).toEqual(['HOER_M2', 'HOER_M2', 'HOER_M3', 'THOMAS'])
  })

  it('sidecar cũ chưa có persona: đọc bằng persona cũ theo vai, không rơi xuống giọng máy', async () => {
    apiMock.get.mockResolvedValue({ data: { personas: OLD_SIDECAR } })
    expect(await speakExamLine('PRUEFER', 'Nummer 41.', 'HOER_M1')).toBe('played')
    expect(await speakExamLine('PARTNER', 'Ich fahre mit dem Rad.', 'HOER_M2')).toBe('played')
    expect(sentPersonas()).toEqual(['ANNA', 'THOMAS'])
    expect(apiMock.get).toHaveBeenCalledTimes(1)
  })

  it('backend cũ chưa có endpoint danh sách (404) hoặc danh sách rỗng: vẫn persona cũ', async () => {
    apiMock.get.mockRejectedValueOnce({ response: { status: 404 } })
    expect(await speakExamLine('PARTNER', 'Hallo.', 'HOER_M2')).toBe('played')
    resetExamTtsPersonaSupport()
    apiMock.get.mockResolvedValueOnce({ data: { personas: [] } })
    expect(await speakExamLine('PRUEFER', 'Hallo.', 'HOER_F1')).toBe('played')
    expect(sentPersonas()).toEqual(['THOMAS', 'ANNA'])
  })

  it('máy chủ từ chối persona mới (422): thử lại câu đó bằng persona cũ', async () => {
    apiMock.get.mockResolvedValue({ data: { personas: NEW_SIDECAR } })
    apiMock.post.mockRejectedValueOnce({ response: { status: 422 } })
    expect(await speakExamLine('PARTNER', 'Ich fahre mit dem Rad.', 'HOER_M2')).toBe('played')
    expect(sentPersonas()).toEqual(['HOER_M2', 'THOMAS'])
  })

  it('mất mạng / hết giờ với persona mới: không thử lại (đường lui giọng máy như trước)', async () => {
    apiMock.get.mockResolvedValue({ data: { personas: NEW_SIDECAR } })
    apiMock.post.mockRejectedValueOnce(new Error('timeout'))
    expect(await speakExamLine('PARTNER', 'Ich fahre mit dem Rad.', 'HOER_M2')).toBe('failed')
    expect(sentPersonas()).toEqual(['HOER_M2'])
  })
})
