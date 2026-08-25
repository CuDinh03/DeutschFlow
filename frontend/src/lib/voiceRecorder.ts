/**
 * voiceRecorder.ts — MediaRecorder wrapper with MIME auto-detection and
 * AudioContext analyser for real-time waveform visualization.
 */

export interface RecorderHandle {
  stop: () => void
  analyser: AnalyserNode
  stream: MediaStream
}

/**
 * Detect the best supported MIME type for audio recording.
 * Falls back through common types; Safari iOS uses audio/mp4.
 */
function detectMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return '' // let browser decide
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

/**
 * Starts microphone recording.
 *
 * @param onStop  called with the recorded Blob when recording stops
 * @returns RecorderHandle with `stop()`, `analyser` (AnalyserNode), and `stream`
 */
export async function startRecorder(
  onStop: (blob: Blob) => void
): Promise<RecorderHandle> {
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

  // Build AudioContext analyser for real-time waveform
  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)

  const mimeType = detectMimeType()
  // 128 kbps opus mono: dư dả cho STT (Whisper nghe 16 kHz), tránh bitrate mặc định thấp của trình duyệt.
  const mr = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 128_000,
  })
  const chunks: Blob[] = []

  mr.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  mr.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
    onStop(blob)
    stream.getTracks().forEach((t) => t.stop())
    audioCtx.close()
  }

  mr.start(100) // collect data every 100ms

  return {
    stop: () => { if (mr.state !== 'inactive') mr.stop() },
    analyser,
    stream,
  }
}
