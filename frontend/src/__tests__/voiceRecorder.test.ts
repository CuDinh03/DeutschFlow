/**
 * voiceRecorder — hợp đồng thu âm cho lượt nói (QA prod 26/08: lượt dài bị 413 "vượt 25MB").
 *
 *   1. Trần 180s: recorder TỰ dừng-và-nộp đúng mốc, không sớm hơn một nhịp nào.
 *   2. Dừng tay: người dùng bấm dừng bất cứ lúc nào vẫn nộp ngay, không phải chờ hết giờ.
 *   3. Nộp đúng một lần: hết giờ + bấm dừng trùng nhau, gọi stop() lặp, onstop bắn muộn sau
 *      watchdog — tất cả chỉ được sinh MỘT lượt nộp (mỗi lượt thừa = một lần trừ quota AI).
 *   4. Codec/bitrate: Opus trước, MP4/AAC làm đường lui cho Safari/iOS, và fallback cuối khi
 *      trình duyệt không nhận mimeType nào. Bitrate đi theo codec, đủ nhỏ để 180s < trần upload.
 *   5. Trả mic: track + AudioContext đóng trên MỌI đường ra, kể cả khi khởi tạo recorder ném lỗi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  startRecorder,
  pickRecordingProfile,
  DEFAULT_MAX_RECORDING_MS,
  MAX_TRANSCRIBE_BYTES,
  type RecorderResult,
} from '@/lib/voiceRecorder'

// ── Test doubles ────────────────────────────────────────────────────────────────────────────

class FakeMediaRecorder {
  static supported: string[] = []
  static instances: FakeMediaRecorder[] = []
  static throwOnConstruct = false
  static isTypeSupported = (t: string) => FakeMediaRecorder.supported.includes(t)

  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  stopCalls = 0
  timeslice: number | undefined
  /** Loại trình duyệt thực sự ghi; rỗng như MediaRecorder chưa khai báo gì. */
  mimeType = ''
  /** true = stop() không bắn onstop (media treo trên iOS) — chỉ watchdog cứu được. */
  hangOnStop = false
  /** true = onstop bắn muộn; test tự gọi flushStop() để mô phỏng độ trễ thật. */
  deferOnStop = false
  private pendingStop = false

  constructor(
    public stream: MediaStream,
    public options: { mimeType?: string; audioBitsPerSecond?: number },
  ) {
    if (FakeMediaRecorder.throwOnConstruct) throw new Error('NotSupportedError')
    FakeMediaRecorder.instances.push(this)
  }

  start(timeslice?: number) {
    this.timeslice = timeslice
    this.state = 'recording'
  }

  stop() {
    this.stopCalls++
    this.state = 'inactive'
    if (this.hangOnStop) return
    if (this.deferOnStop) {
      this.pendingStop = true
      return
    }
    this.onstop?.()
  }

  /** Bắn onstop đang treo (chế độ deferOnStop). */
  flushStop() {
    if (!this.pendingStop) return
    this.pendingStop = false
    this.onstop?.()
  }

  emit(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) })
  }
}

let tracks: { stop: ReturnType<typeof vi.fn>; kind: string }[] = []
let audioContexts: FakeAudioContext[] = []

class FakeAudioContext {
  state: AudioContextState = 'running'
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createMediaStreamSource = () => ({ connect: vi.fn() })
  createAnalyser = () => ({ fftSize: 0, frequencyBinCount: 128 })
  constructor() {
    audioContexts.push(this)
  }
}

function stubEnvironment(supported: string[]) {
  tracks = [{ stop: vi.fn(), kind: 'audio' }]
  audioContexts = []
  FakeMediaRecorder.supported = supported
  FakeMediaRecorder.instances = []
  FakeMediaRecorder.throwOnConstruct = false
  const stream = { getTracks: () => tracks } as unknown as MediaStream
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } })
  return stream
}

/** Bắt đầu thu và trả về recorder giả + spy nộp. */
async function begin(options?: Parameters<typeof startRecorder>[1]) {
  const onStop = vi.fn<(blob: Blob, result: RecorderResult) => void>()
  const handle = await startRecorder(onStop, options)
  const mr = FakeMediaRecorder.instances.at(-1)!
  return { handle, mr, onStop }
}

beforeEach(() => {
  vi.useFakeTimers()
  stubEnvironment(['audio/webm;codecs=opus', 'audio/webm'])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ── 1+2. Trần 180 giây và dừng tay ──────────────────────────────────────────────────────────

describe('trần thời lượng 180 giây', () => {
  it('tự dừng-và-nộp ĐÚNG mốc 180s, không sớm hơn', async () => {
    const { mr, onStop } = await begin()
    mr.emit(1024)

    // Một nhịp trước mốc: vẫn đang thu, chưa nộp gì.
    vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS - 1)
    expect(onStop).not.toHaveBeenCalled()
    expect(mr.state).toBe('recording')

    vi.advanceTimersByTime(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][1].reason).toBe('timeout')
    expect(onStop.mock.calls[0][1].durationMs).toBe(DEFAULT_MAX_RECORDING_MS)
    expect(mr.state).toBe('inactive')
  })

  it('mốc mặc định đúng 180 giây và blob 180s nằm dưới trần upload của backend', () => {
    expect(DEFAULT_MAX_RECORDING_MS).toBe(180_000)
    // Bitrate cao nhất trong bảng hồ sơ là 64 kbps ⇒ 180s ≈ 1,44MB, dư dả dưới trần 8MB.
    const worstCaseBytes = (64_000 / 8) * (DEFAULT_MAX_RECORDING_MS / 1000)
    expect(worstCaseBytes).toBeLessThan(MAX_TRANSCRIBE_BYTES)
  })

  it('người dùng bấm dừng sớm → nộp ngay với reason "manual"', async () => {
    const { handle, mr, onStop } = await begin()
    vi.advanceTimersByTime(12_000)
    mr.emit(2048)

    handle.stop()

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][1].reason).toBe('manual')
    expect(onStop.mock.calls[0][1].durationMs).toBe(12_000)
    expect(onStop.mock.calls[0][0].size).toBe(2048)
  })

  it('maxDurationMs = 0 → không có trần (recorder chạy đến khi bấm dừng)', async () => {
    const { handle, onStop } = await begin({ maxDurationMs: 0 })
    vi.advanceTimersByTime(30 * 60_000)
    expect(onStop).not.toHaveBeenCalled()
    handle.stop()
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('onTick báo thời lượng đã thu để UI đếm ngược', async () => {
    const onTick = vi.fn<(elapsed: number) => void>()
    await begin({ onTick })
    vi.advanceTimersByTime(1_000)
    expect(onTick).toHaveBeenCalled()
    expect(onTick.mock.calls.at(-1)![0]).toBe(1_000)
  })
})

// ── 3. Không nộp hai lần ────────────────────────────────────────────────────────────────────

describe('nộp đúng một lần', () => {
  it('bấm dừng NGAY trước khi hết giờ → chỉ một lượt nộp', async () => {
    const { handle, mr, onStop } = await begin()
    mr.deferOnStop = true // onstop đến muộn: khe đua thật của trình duyệt

    vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS - 1)
    handle.stop() // người dùng bấm dừng trong mili-giây cuối
    vi.advanceTimersByTime(5_000) // trần thời lượng ĐÁNG LẼ bắn ở đây
    mr.flushStop() // rồi onstop thật mới tới

    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][1].reason).toBe('manual')
    expect(mr.stopCalls).toBe(1)
  })

  it('gọi stop() nhiều lần → vẫn chỉ một lượt nộp', async () => {
    const { handle, mr, onStop } = await begin()
    handle.stop()
    handle.stop()
    handle.stop()
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(mr.stopCalls).toBe(1)
  })

  it('hết giờ rồi người dùng mới bấm dừng → không nộp lần hai', async () => {
    const { handle, onStop } = await begin()
    vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    expect(onStop).toHaveBeenCalledTimes(1)
    handle.stop()
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('media treo không bắn onstop → watchdog vẫn nộp, và onstop đến muộn không nộp thêm', async () => {
    const { handle, mr, onStop } = await begin()
    mr.hangOnStop = true
    mr.emit(512)

    handle.stop()
    expect(onStop).not.toHaveBeenCalled() // đang chờ onstop

    vi.advanceTimersByTime(3_000)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStop.mock.calls[0][0].size).toBe(512)

    mr.onstop?.() // trình duyệt tỉnh lại muộn
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('cancel() → KHÔNG nộp (unmount không được tự gửi lượt nói dở dang)', async () => {
    const { handle, mr, onStop } = await begin()
    mr.emit(4096)
    handle.cancel()

    expect(onStop).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalled()

    vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    handle.stop()
    expect(onStop).not.toHaveBeenCalled()
  })
})

// ── 4. Codec / bitrate / fallback ───────────────────────────────────────────────────────────

describe('chọn codec và bitrate', () => {
  it('Chrome/Android → Opus trong webm ở 48 kbps', () => {
    stubEnvironment(['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'])
    expect(pickRecordingProfile()).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 48_000 })
  })

  it('Safari/iOS cũ (chỉ MP4) → audio/mp4 AAC ở 64 kbps', () => {
    stubEnvironment(['audio/mp4', 'audio/mp4;codecs=mp4a.40.2'])
    expect(pickRecordingProfile()).toEqual({ mimeType: 'audio/mp4;codecs=mp4a.40.2', audioBitsPerSecond: 64_000 })
  })

  it('trình duyệt không nhận mimeType nào → fallback để trình duyệt tự chọn', () => {
    stubEnvironment([])
    expect(pickRecordingProfile()).toEqual({ mimeType: '', audioBitsPerSecond: 64_000 })
  })

  it('isTypeSupported ném lỗi trên WebView lạ → bỏ qua mục đó, không làm sập việc thu', () => {
    stubEnvironment(['audio/mp4'])
    FakeMediaRecorder.isTypeSupported = (t: string) => {
      if (t.startsWith('audio/webm')) throw new TypeError('bad mime')
      return t === 'audio/mp4'
    }
    expect(pickRecordingProfile().mimeType).toBe('audio/mp4')
    FakeMediaRecorder.isTypeSupported = (t: string) => FakeMediaRecorder.supported.includes(t)
  })

  it('bitrate được truyền xuống MediaRecorder và blob mang đúng MIME đã chọn', async () => {
    stubEnvironment(['audio/mp4'])
    const { handle, mr, onStop } = await begin()
    expect(mr.options).toEqual({ mimeType: 'audio/mp4', audioBitsPerSecond: 64_000 })
    expect(handle.mimeType).toBe('audio/mp4')
    mr.emit(10)
    handle.stop()
    expect(onStop.mock.calls[0][0].type).toBe('audio/mp4')
  })

  it('fallback không ép mimeType lên MediaRecorder (Safari cổ ném NotSupportedError nếu ép)', async () => {
    stubEnvironment([])
    const { mr } = await begin()
    expect(mr.options).toEqual({ audioBitsPerSecond: 64_000 })
    expect('mimeType' in mr.options).toBe(false)
  })

  it('fallback → dán nhãn blob theo loại trình duyệt THỰC SỰ ghi, không đoán bừa audio/webm', async () => {
    // Safari đường lui: ta không ép mimeType, nhưng nó ghi MP4 và khai qua mr.mimeType.
    stubEnvironment([])
    const { handle, mr, onStop } = await begin()
    mr.mimeType = 'audio/mp4'
    mr.emit(64)
    handle.stop()
    expect(onStop.mock.calls[0][0].type).toBe('audio/mp4')
  })

  it('fallback mà trình duyệt cũng không khai gì → mới dùng audio/webm', async () => {
    stubEnvironment([])
    const { handle, mr, onStop } = await begin()
    mr.emit(64)
    handle.stop()
    expect(onStop.mock.calls[0][0].type).toBe('audio/webm')
  })

  it('timeslice 1000ms — dạng sóng vẽ bằng analyser nên không cần chunk 100ms', async () => {
    const { mr } = await begin()
    expect(mr.timeslice).toBe(1000)
  })
})

// ── 5. Trả mic về hệ điều hành ──────────────────────────────────────────────────────────────

describe('dọn tài nguyên', () => {
  it('dừng thường → tắt track và đóng AudioContext', async () => {
    const { handle } = await begin()
    handle.stop()
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(audioContexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('hết giờ → tắt track và đóng AudioContext', async () => {
    await begin()
    vi.advanceTimersByTime(DEFAULT_MAX_RECORDING_MS)
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(audioContexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('khởi tạo MediaRecorder ném lỗi → mic vẫn được trả về, không sáng mồ côi', async () => {
    FakeMediaRecorder.throwOnConstruct = true
    await expect(startRecorder(vi.fn())).rejects.toThrow()
    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
    expect(audioContexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('bộ đếm giờ được dọn — sau khi dừng không còn tick nào chạy', async () => {
    const onTick = vi.fn()
    const { handle } = await begin({ onTick })
    vi.advanceTimersByTime(1_000)
    const before = onTick.mock.calls.length
    handle.stop()
    vi.advanceTimersByTime(60_000)
    expect(onTick.mock.calls.length).toBe(before)
  })
})
