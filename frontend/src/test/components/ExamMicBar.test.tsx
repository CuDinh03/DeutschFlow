/**
 * MicBar — thanh thu âm của phòng thi nói, kiểm qua voiceRecorder THẬT (chỉ MediaRecorder/
 * getUserMedia là giả). Bốn hợp đồng mà QA prod 26/08 đòi:
 *
 *   1. Hết 180s → tự nộp đúng MỘT lần, UI trở về trạng thái "bấm để nói".
 *   2. Bấm dừng sớm → nộp ngay, cũng đúng một lần.
 *   3. Chạm kép trong khe `await getUserMedia` → chỉ MỘT MediaRecorder (chạm thứ hai không được
 *      tạo recorder mồ côi thu ngầm giữ mic sáng).
 *   4. Unmount giữa chừng → KHÔNG nộp lượt dở dang, nhưng vẫn trả mic về hệ điều hành.
 *
 * Catalog vi THẬT → test canh luôn khoá i18n của đồng hồ đếm ngược.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import studentVi from '../../../messages/v2/student.vi.json'
import { MicBar } from '@/components/features/exam-speaking/MicBar'
import { DEFAULT_MAX_RECORDING_MS } from '@/lib/voiceRecorder'

vi.mock('@/hooks/useMicPermission', () => ({ useMicPermission: () => 'granted' }))

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(
    public stream: MediaStream,
    public options: unknown,
  ) {
    FakeMediaRecorder.instances.push(this)
  }
  start() {
    this.state = 'recording'
    // Bản ghi có tiếng: MicBar bỏ qua blob rỗng nên phải có dữ liệu thật.
    this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)]) })
  }
  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createMediaStreamSource = () => ({ connect: vi.fn() })
  createAnalyser = () => ({ fftSize: 0, frequencyBinCount: 128 })
}

let tracks: { stop: ReturnType<typeof vi.fn> }[] = []
/** Khi đặt, getUserMedia treo cho tới lúc test gọi — mô phỏng khe chờ cấp quyền. */
let releaseGetUserMedia: (() => void) | null = null

function stubMedia({ deferPermission = false } = {}) {
  tracks = [{ stop: vi.fn() }]
  FakeMediaRecorder.instances = []
  const stream = { getTracks: () => tracks } as unknown as MediaStream
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        if (deferPermission) {
          await new Promise<void>((resolve) => {
            releaseGetUserMedia = resolve
          })
        }
        return stream
      }),
    },
  })
}

function renderBar(onAudio: (blob: Blob) => Promise<void>) {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...studentVi } }}>
      <MicBar disabled={false} busy={false} allowText onAudio={onAudio} onText={vi.fn()} hint="Nói đi" />
    </NextIntlClientProvider>,
  )
}

/** Bấm nút và để mọi promise đang chờ chạy xong. */
async function click(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  releaseGetUserMedia = null
  stubMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('MicBar — trần 180 giây', () => {
  it('hết 180s → tự nộp đúng một lần và UI về trạng thái bấm-để-nói', async () => {
    const onAudio = vi.fn<(blob: Blob) => Promise<void>>(async () => {})
    renderBar(onAudio)
    await click('mic-start')
    expect(screen.getByTestId('mic-stop')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    })

    expect(onAudio).toHaveBeenCalledTimes(1)
    expect(onAudio.mock.calls[0][0].size).toBe(2048)
    expect(screen.getByTestId('mic-start')).toBeInTheDocument()
    expect(screen.queryByTestId('mic-stop')).not.toBeInTheDocument()
  })

  it('đồng hồ đếm ngược chạy từ 03:00 và giảm dần trong lúc thu', async () => {
    renderBar(vi.fn(async () => {}))
    await click('mic-start')
    expect(screen.getByTestId('mic-remaining')).toHaveTextContent('03:00')

    await act(async () => {
      vi.advanceTimersByTime(65_000)
    })
    expect(screen.getByTestId('mic-remaining')).toHaveTextContent('01:55')
  })

  it('bấm dừng sớm → nộp ngay, một lần, và trần thời lượng không nộp thêm lần nữa', async () => {
    const onAudio = vi.fn<(blob: Blob) => Promise<void>>(async () => {})
    renderBar(onAudio)
    await click('mic-start')

    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })
    await click('mic-stop')
    expect(onAudio).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    })
    expect(onAudio).toHaveBeenCalledTimes(1)
  })
})

describe('MicBar — chống đua và dọn tài nguyên', () => {
  it('chạm kép lúc đang xin quyền → chỉ một MediaRecorder, không có bản thu mồ côi', async () => {
    stubMedia({ deferPermission: true })
    renderBar(vi.fn(async () => {}))

    // Hai lần chạm liên tiếp trong khe `await getUserMedia` — nút vẫn còn trên màn hình.
    fireEvent.click(screen.getByTestId('mic-start'))
    fireEvent.click(screen.getByTestId('mic-start'))
    await act(async () => {
      releaseGetUserMedia?.()
    })

    expect(FakeMediaRecorder.instances).toHaveLength(1)
    expect(screen.getByTestId('mic-stop')).toBeInTheDocument()
  })

  it('unmount giữa lúc thu → KHÔNG nộp lượt dở dang nhưng vẫn trả mic về', async () => {
    const onAudio = vi.fn<(blob: Blob) => Promise<void>>(async () => {})
    const { unmount } = renderBar(onAudio)
    await click('mic-start')

    await act(async () => {
      unmount()
    })

    expect(onAudio).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)

    // Trần thời lượng của bản ghi đã huỷ cũng không được đánh thức lượt nộp nào.
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    })
    expect(onAudio).not.toHaveBeenCalled()
  })

  it('bản ghi rỗng → KHÔNG nộp nhưng phải báo lỗi, không im lặng nuốt lượt nói', async () => {
    const onAudio = vi.fn<(blob: Blob) => Promise<void>>(async () => {})
    // Mic bị OS thu hồi giữa chừng: recorder chạy nhưng không có chunk nào.
    const silent = class extends FakeMediaRecorder {
      start() {
        this.state = 'recording'
      }
    }
    vi.stubGlobal('MediaRecorder', silent)
    renderBar(onAudio)
    await click('mic-start')
    await click('mic-stop')

    expect(onAudio).not.toHaveBeenCalled()
    expect(screen.getByTestId('mic-error')).toBeInTheDocument()
    expect(screen.getByTestId('mic-retry')).toBeInTheDocument()
    expect(screen.getByTestId('mic-start')).toBeInTheDocument()
  })

  it('unmount NGAY khi quyền mic vừa được cấp → recorder bị huỷ, mic không sáng mồ côi', async () => {
    stubMedia({ deferPermission: true })
    const onAudio = vi.fn<(blob: Blob) => Promise<void>>(async () => {})
    const { unmount } = renderBar(onAudio)

    fireEvent.click(screen.getByTestId('mic-start'))
    unmount()
    await act(async () => {
      releaseGetUserMedia?.()
    })

    expect(onAudio).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
  })
})
