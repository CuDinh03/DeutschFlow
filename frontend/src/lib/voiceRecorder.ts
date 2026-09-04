/**
 * voiceRecorder.ts — MediaRecorder wrapper with MIME auto-detection and
 * AudioContext analyser for real-time waveform visualization.
 *
 * Ba hợp đồng bắt buộc (QA prod 26/08 — lượt nói dài bị 413 "vượt 25MB"):
 *
 * 1. TRẦN THỜI LƯỢNG. Trước đây recorder chạy đến khi người dùng bấm dừng — không có mốc kết
 *    thúc nào khác. Đồng hồ Teil hết giờ ở chế độ luyện phần chỉ hiện badge "hết giờ", KHÔNG
 *    đụng tới recorder, nên một lượt bỏ quên cứ thu mãi cho tới lúc blob vượt trần multipart
 *    25MB của backend và cả lượt nói mất trắng. Nay recorder tự dừng-và-nộp tại
 *    `maxDurationMs` (mặc định {@link DEFAULT_MAX_RECORDING_MS} = 180s = đúng thời lượng một
 *    Teil dài nhất ở A2). Trần nằm TRONG recorder chứ không ở component: chỉ nơi giữ
 *    MediaRecorder mới dừng được nó một cách chắc chắn, và một nguồn sự thật thì không đua.
 *
 * 2. NỘP ĐÚNG MỘT LẦN. `onStop` được gọi tối đa một lần cho mỗi lần thu, bất kể hết giờ và
 *    người dùng bấm dừng trùng nhau, `stop()` bị gọi lặp, hay `onstop` của MediaRecorder bắn
 *    muộn sau watchdog. Không có chốt này thì mỗi lượt nói có thể nộp hai lần (hai lần trừ
 *    quota AI, hai dòng transcript).
 *
 * 3. TRẢ MIC VỀ HỆ ĐIỀU HÀNH. Track + AudioContext được đóng trên MỌI đường ra: dừng thường,
 *    hết giờ, `cancel()` lúc unmount, và cả khi khởi tạo MediaRecorder ném lỗi sau khi
 *    getUserMedia đã thành công (nhánh này trước đây bỏ rơi stream ⇒ đèn mic sáng vĩnh viễn).
 */

/** Trần thời lượng mặc định cho một lượt nói (ms). 180s = Teil dài nhất của Goethe A2. */
export const DEFAULT_MAX_RECORDING_MS = 180_000

/**
 * Trần kích thước upload phía client, khớp `app.ai.transcribe.max-bytes` của backend
 * (`AI_TRANSCRIBE_MAX_BYTES`, mặc định 8MB). Đây là trần THẬT của endpoint phiên âm — thấp hơn
 * trần multipart 25MB của Spring — nên client phải đo theo mốc này thì thông báo mới trung thực.
 */
export const MAX_TRANSCRIBE_BYTES = 8 * 1024 * 1024

/** Nhịp báo thời lượng đã thu cho UI (ms). */
const TICK_MS = 250

/**
 * Timeslice của MediaRecorder (ms). 1000ms thay vì 100ms: dạng sóng vẽ bằng AnalyserNode chứ
 * không bằng chunk, nên chia nhỏ 10× chỉ tạo thêm 10× đối tượng Blob mà không thêm thông tin gì.
 */
const TIMESLICE_MS = 1000

/**
 * Trần chờ `onstop` sau khi đã gọi `MediaRecorder.stop()` (ms). Cùng lý do với watchdog của
 * examTts: media trên iOS có thể treo không bắn event nào (tab bị nền, audio session bị OS thu
 * hồi). Không có trần này thì nút mic kẹt ở trạng thái "đang thu" và lượt nói chết cứng.
 */
const STOP_WATCHDOG_MS = 3_000

export type RecorderStopReason = 'manual' | 'timeout' | 'error'

export interface RecorderResult {
  /** Vì sao bản ghi kết thúc — `timeout` = chạm trần thời lượng. */
  reason: RecorderStopReason
  /** Thời lượng thu thực tế (ms). */
  durationMs: number
}

export interface RecorderHandle {
  /** Dừng và nộp. Idempotent: gọi bao nhiêu lần cũng chỉ sinh một `onStop`. */
  stop: () => void
  /**
   * Huỷ: dừng thu và trả mic ngay, KHÔNG gọi `onStop`. Dùng khi unmount — nộp một lượt nói cho
   * màn hình vừa bị gỡ là gửi dữ liệu người dùng không hề yêu cầu.
   */
  cancel: () => void
  analyser: AnalyserNode
  stream: MediaStream
  /** MIME thực tế đang thu (đã chọn theo trình duyệt). */
  mimeType: string
  /** Trần thời lượng đang áp (ms) — UI vẽ đồng hồ theo đúng mốc recorder sẽ tự dừng. */
  maxDurationMs: number
}

export interface RecorderOptions {
  /** Trần thời lượng (ms); recorder tự dừng-và-nộp khi chạm mốc. `0` = không giới hạn. */
  maxDurationMs?: number
  /** Gọi mỗi ~250ms với số ms đã thu — cho UI đếm ngược. */
  onTick?: (elapsedMs: number) => void
}

/**
 * Hồ sơ thu, xếp theo thứ tự ưu tiên. Bitrate đi kèm codec chứ không phải một hằng số dùng chung:
 * Opus ở 48 kbps mono đã trong suốt với giọng nói (Whisper còn hạ xuống 16 kHz), trong khi AAC
 * cần khoảng 64 kbps để tương đương. Trước đây mọi codec dùng chung 128 kbps — gấp đôi mức cần
 * thiết cho STT và làm mỗi phút nói nặng gấp đôi khi lên mạng di động.
 *
 * Safari/iOS ≤18.3 chỉ thu được MP4/AAC nên hai mục `audio/mp4` là đường lui bắt buộc; Safari mới
 * và Chrome/Android bắt ngay Opus ở đầu danh sách. Mục cuối `audio/webm` trần để trình duyệt tự
 * chọn codec trong container nó hiểu.
 */
const PROFILES: readonly { mimeType: string; audioBitsPerSecond: number }[] = [
  { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 48_000 },
  { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 48_000 },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', audioBitsPerSecond: 64_000 },
  { mimeType: 'audio/mp4', audioBitsPerSecond: 64_000 },
  { mimeType: 'audio/webm', audioBitsPerSecond: 48_000 },
]

/** Đường lui cuối: trình duyệt tự quyết container/codec (không ép mimeType). */
const FALLBACK_PROFILE = { mimeType: '', audioBitsPerSecond: 64_000 }

/**
 * Chọn hồ sơ thu đầu tiên mà trình duyệt khai báo hỗ trợ.
 * Trình duyệt cổ không có `isTypeSupported` thì rơi thẳng về hồ sơ tự-quyết.
 */
export function pickRecordingProfile(): { mimeType: string; audioBitsPerSecond: number } {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return FALLBACK_PROFILE
  }
  for (const profile of PROFILES) {
    try {
      if (MediaRecorder.isTypeSupported(profile.mimeType)) return profile
    } catch {
      // isTypeSupported ném với chuỗi lạ trên vài WebView — coi như không hỗ trợ, thử mục sau.
    }
  }
  return FALLBACK_PROFILE
}

/**
 * Raise a tagged Error for capture failures the browser can't report through a
 * getUserMedia DOMException, so `classifyMicError` can attribute them precisely.
 */
function unsupported(name: 'MicUnsupportedError' | 'MicInsecureContextError', message: string): never {
  const err = new Error(message)
  err.name = name
  throw err
}

/** Trả mic về hệ điều hành. Chịu lỗi từng phần: một track hỏng không được chặn phần dọn còn lại. */
function releaseCapture(stream: MediaStream, audioCtx: AudioContext | null): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // track đã chết — không có gì để dọn thêm.
    }
  }
  if (audioCtx && audioCtx.state !== 'closed') {
    try {
      void audioCtx.close()
    } catch {
      // AudioContext đã đóng hoặc đang đóng — bỏ qua.
    }
  }
}

/**
 * Starts microphone recording.
 *
 * @param onStop  called with the recorded Blob when recording stops (tối đa MỘT lần)
 * @param options trần thời lượng + nhịp báo thời gian cho UI
 * @returns RecorderHandle with `stop()`, `cancel()`, `analyser` (AnalyserNode), and `stream`
 */
export async function startRecorder(
  onStop: (blob: Blob, result: RecorderResult) => void,
  options: RecorderOptions = {}
): Promise<RecorderHandle> {
  const { maxDurationMs = DEFAULT_MAX_RECORDING_MS, onTick } = options

  // Browsers hide `navigator.mediaDevices` on non-secure (HTTP) origins. Detect
  // this up front so the user sees "needs HTTPS" rather than "permission denied".
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      unsupported('MicInsecureContextError', 'Microphone requires a secure (HTTPS) context')
    }
    unsupported('MicUnsupportedError', 'getUserMedia is not supported in this browser')
  }
  if (typeof MediaRecorder === 'undefined') {
    unsupported('MicUnsupportedError', 'MediaRecorder is not supported in this browser')
  }

  // Cấu hình thu tối ưu cho STT tiếng Đức (25/08):
  // - echoCancellation: BẮT BUỘC — Prüfer/partner TTS phát qua loa; không có EC thì mic thu cả
  //   giọng AI và Whisper phiên âm lẫn lời AI vào lượt của thí sinh.
  // - noiseSuppression + autoGainControl: giọng học viên rõ và đều mức trước khi nén opus.
  // - channelCount 1: Whisper downmix mono — thu mono ngay cho sạch và nhẹ.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  })

  // Từ đây trở đi stream ĐÃ mở: mọi lỗi phải trả mic lại trước khi ném ra ngoài.
  let audioCtx: AudioContext | null = null
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new Ctx()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const profile = pickRecordingProfile()
    const mr = new MediaRecorder(stream, {
      ...(profile.mimeType ? { mimeType: profile.mimeType } : {}),
      audioBitsPerSecond: profile.audioBitsPerSecond,
    })

    const chunks: Blob[] = []
    const startedAt = Date.now()
    const ctx = audioCtx

    /**
     * Loại MIME để dán lên blob. Ở nhánh fallback ta CỐ Ý không ép `mimeType`, nên `profile.mimeType`
     * rỗng và chỉ `mr.mimeType` mới biết trình duyệt thực sự ghi gì — Safari/iOS ghi MP4. Dán cứng
     * 'audio/webm' ở đó là gửi lên một phần multipart khai webm nhưng chứa bytes mp4 (và ExamRoom
     * đặt tên tệp .webm theo `blob.type`), khiến bộ phiên âm nhận nhầm container.
     */
    const effectiveMimeType = () => profile.mimeType || mr.mimeType || 'audio/webm'

    let settled = false
    let stopRequested = false
    let cancelled = false
    let pendingReason: RecorderStopReason = 'manual'
    let tickTimer: number | undefined
    let maxTimer: number | undefined
    let watchdogTimer: number | undefined

    const clearTimers = () => {
      if (tickTimer !== undefined) window.clearInterval(tickTimer)
      if (maxTimer !== undefined) window.clearTimeout(maxTimer)
      if (watchdogTimer !== undefined) window.clearTimeout(watchdogTimer)
      tickTimer = maxTimer = watchdogTimer = undefined
    }

    /**
     * Điểm ra DUY NHẤT. `settled` là chốt chống nộp hai lần: hết giờ, người dùng bấm dừng,
     * watchdog và `onstop` đến muộn đều đi qua đây và chỉ lần đầu tiên có tác dụng.
     *
     * `cancelled` phải là cờ RIÊNG chứ không phải tham số: `cancel()` gọi `mr.stop()`, mà trên
     * trình duyệt thật `onstop` có thể bắn ngay trong lời gọi đó và tự nó đi vào `finalize` với
     * ý định "nộp". Đọc cờ tại đây thì mọi ngả vào đều thấy quyết định huỷ.
     */
    const finalize = (reason: RecorderStopReason) => {
      if (settled) return
      settled = true
      clearTimers()
      releaseCapture(stream, ctx)
      if (cancelled) return
      const blob = new Blob(chunks, { type: effectiveMimeType() })
      onStop(blob, { reason, durationMs: Date.now() - startedAt })
    }

    const requestStop = (reason: RecorderStopReason) => {
      if (settled || stopRequested) return
      stopRequested = true
      pendingReason = reason
      clearTimers()
      if (mr.state === 'inactive') {
        finalize(reason)
        return
      }
      try {
        mr.stop()
      } catch {
        // stop() ném (state đua) — chốt sổ ngay với những gì đã thu được.
        finalize(reason)
        return
      }
      watchdogTimer = window.setTimeout(() => finalize(reason), STOP_WATCHDOG_MS)
    }

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    mr.onstop = () => finalize(pendingReason)
    mr.onerror = () => requestStop('error')

    mr.start(TIMESLICE_MS)

    if (onTick) {
      tickTimer = window.setInterval(() => onTick(Date.now() - startedAt), TICK_MS)
    }
    if (maxDurationMs > 0) {
      maxTimer = window.setTimeout(() => requestStop('timeout'), maxDurationMs)
    }

    return {
      stop: () => requestStop('manual'),
      cancel: () => {
        if (settled) return
        cancelled = true
        stopRequested = true
        if (mr.state !== 'inactive') {
          try {
            mr.stop()
          } catch {
            // không sao — finalize bên dưới vẫn trả mic về.
          }
        }
        finalize('manual')
      },
      analyser,
      stream,
      mimeType: effectiveMimeType(),
      maxDurationMs,
    }
  } catch (e) {
    releaseCapture(stream, audioCtx)
    throw e
  }
}
