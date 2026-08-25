/**
 * Watchdog của examTts (QA prod 25/08): <audio> blob có thể TREO ở readyState 0 không bắn event nào
 * (không loadedmetadata/ended/error, play() không settle) ⇒ speakExamLine phải tự resolve bằng trần
 * thời gian, nếu không turn-gate khoá mic vĩnh viễn.
 *   1. Không event nào → resolve sau trần theo độ dài câu (3000 + 100ms/ký tự).
 *   2. loadedmetadata biết duration thật → trần siết về duration + 2s.
 *   3. stopExamTts() → resolve NGAY (hợp đồng cắt ngang).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const apiMock = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: apiMock }))

import { speakExamLine, stopExamTts } from '@/components/features/exam-speaking/examTts'

/** Audio giả lập ca treo: nhận handler nhưng KHÔNG tự bắn event nào; play() không bao giờ settle. */
class HungAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  duration = NaN
  paused = false
  play() {
    return new Promise<void>(() => {})
  }
  pause() {
    this.paused = true
  }
}

let lastAudio: HungAudio | null = null

beforeEach(() => {
  vi.useFakeTimers()
  apiMock.post.mockResolvedValue({ data: new Blob([new Uint8Array(64)], { type: 'audio/mpeg' }) })
  vi.stubGlobal(
    'Audio',
    class extends HungAudio {
      constructor() {
        super()
        lastAudio = this
      }
    },
  )
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:test', revokeObjectURL: () => {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function settled(p: Promise<void>): Promise<boolean> {
  let done = false
  void p.then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

describe('examTts watchdog', () => {
  it('audio treo không event → resolve sau trần theo độ dài câu', async () => {
    const text = 'Hallo!' // 6 ký tự → trần 3000 + 600 = 3600ms
    const p = speakExamLine('PRUEFER', text)
    await vi.advanceTimersByTimeAsync(3500)
    expect(await settled(p)).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(await settled(p)).toBe(true)
  })

  it('loadedmetadata có duration → trần siết về duration + 2s (không chờ hết trần câu dài)', async () => {
    const long = 'a'.repeat(200) // trần theo câu = 23s
    const p = speakExamLine('PARTNER', long)
    await vi.advanceTimersByTimeAsync(50)
    lastAudio!.duration = 1.5
    lastAudio!.onloadedmetadata?.()
    await vi.advanceTimersByTimeAsync(3400) // 1500 + 2000 = 3500
    expect(await settled(p)).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(await settled(p)).toBe(true)
  })

  it('stopExamTts() cắt ngang → resolve ngay, audio pause', async () => {
    const p = speakExamLine('PRUEFER', 'Guten Tag, wie geht es Ihnen heute?')
    await vi.advanceTimersByTimeAsync(100)
    stopExamTts()
    expect(await settled(p)).toBe(true)
    expect(lastAudio!.paused).toBe(true)
  })
})
