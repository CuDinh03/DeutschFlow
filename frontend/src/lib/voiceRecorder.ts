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
 * Starts microphone recording.
 *
 * @param onStop  called with the recorded Blob when recording stops
 * @returns RecorderHandle with `stop()`, `analyser` (AnalyserNode), and `stream`
 */
export async function startRecorder(
  onStop: (blob: Blob) => void
): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // Build AudioContext analyser for real-time waveform
  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)

  const mimeType = detectMimeType()
  const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
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
