/**
 * PCM Audio Queue — DeutschFlow streaming TTS playback.
 *
 * Plays the per-sentence audio frames streamed from the backend XTTS pipeline (raw PCM `s16le`,
 * 24000 Hz, mono — no WAV container) sequentially and in index order. Built on the Web Audio API
 * because raw PCM cannot be fed to {@link HTMLAudioElement}/`decodeAudioData` (no container).
 *
 * Barge-in: {@link PcmAudioQueue.stop} silences the current sentence and drops anything pending —
 * called when the learner sends a new reply, the session ends, or the page unmounts.
 */

/** One synthesized sentence as delivered on the SSE `audio` event. */
export interface PcmAudioFrame {
  index: number
  text: string
  voiceId?: string
  encoding?: string
  sampleRate?: number
  channels?: number
  pcmBase64: string
}

const DEFAULT_SAMPLE_RATE = 24000

type WebkitWindow = typeof globalThis & { webkitAudioContext?: typeof AudioContext }

/**
 * Decode base64 PCM `s16le` into Float32 samples in [-1, 1). Pure (no Web Audio) → unit-testable.
 */
export function decodePcm16Base64(base64: string): Float32Array {
  const binary = atob(base64)
  const sampleCount = binary.length >> 1 // 2 bytes per 16-bit sample
  const out = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    const lo = binary.charCodeAt(i * 2) & 0xff
    const hi = binary.charCodeAt(i * 2 + 1) & 0xff
    let sample = (hi << 8) | lo // little-endian
    if (sample >= 0x8000) sample -= 0x10000 // two's-complement signed
    out[i] = sample / 32768
  }
  return out
}

export class PcmAudioQueue {
  private ctx: AudioContext | null = null
  private readonly buffers: AudioBuffer[] = []
  private playing = false
  private active: AudioBufferSourceNode | null = null

  /** Lazily create + resume the AudioContext. MUST be called from a user gesture (autoplay policy). */
  resume(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
        if (!Ctx) return
        this.ctx = new Ctx()
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {})
      }
    } catch {
      // AudioContext unavailable (SSR / unsupported) — streaming audio silently disabled.
    }
  }

  /** Queue one sentence for playback (decoded → AudioBuffer → appended in arrival/index order). */
  enqueue(frame: PcmAudioFrame): void {
    if (!frame?.pcmBase64) return
    this.resume()
    if (!this.ctx) return
    try {
      const samples = decodePcm16Base64(frame.pcmBase64)
      if (samples.length === 0) return
      const buffer = this.ctx.createBuffer(1, samples.length, frame.sampleRate || DEFAULT_SAMPLE_RATE)
      buffer.getChannelData(0).set(samples)
      this.buffers.push(buffer)
      if (!this.playing) this.playNext()
    } catch {
      // Skip a single malformed frame; the rest of the turn keeps playing.
    }
  }

  private playNext(): void {
    if (!this.ctx) {
      this.playing = false
      return
    }
    const buffer = this.buffers.shift()
    if (!buffer) {
      this.playing = false
      this.active = null
      return
    }
    this.playing = true
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)
    source.onended = () => {
      if (this.active === source) this.active = null
      this.playNext()
    }
    this.active = source
    try {
      source.start()
    } catch {
      this.playNext()
    }
  }

  /** Stop the current sentence and drop everything pending (barge-in / session end). Reusable after. */
  stop(): void {
    this.buffers.length = 0
    this.playing = false
    const source = this.active
    this.active = null
    if (source) {
      source.onended = null // prevent playNext re-trigger
      try {
        source.stop()
      } catch {
        // already stopped
      }
      try {
        source.disconnect()
      } catch {
        // already disconnected
      }
    }
  }

  /** Stop and release the AudioContext (call on unmount). */
  dispose(): void {
    this.stop()
    const ctx = this.ctx
    this.ctx = null
    if (ctx) void ctx.close().catch(() => {})
  }
}
