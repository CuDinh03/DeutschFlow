import api from '@/lib/api'

/**
 * TTS cho phòng thi: Prüfer và Partner dùng HAI giọng khác nhau (persona backend) để thí sinh phân vai
 * bằng tai như thi thật. Fallback Web Speech khi backend TTS lỗi. Một audio tại một thời điểm.
 *
 * Hợp đồng then chốt cho cơ chế lượt (turn-gate): `speakExamLine` LUÔN resolve — khi audio phát xong,
 * khi lỗi, và cả khi bị `stopExamTts()` cắt ngang (pause() không bắn 'ended' nên stop phải tự resolve,
 * nếu không caller chờ vĩnh viễn và micro bị khoá mãi).
 */
// Chọn persona theo chất giọng sidecar: ANNA = AmalaNeural pitch +0 (nguyên bản, hay);
// PARTNER trước là LUKAS = ConradNeural pitch -15Hz rate -5% — ép pitch lên giọng neural
// nghe méo/robotic (owner phản hồi 25/08). THOMAS = FlorianMultilingualNeural +0/+0:
// nam thân thiện nguyên bản, vẫn tương phản rõ với giám khảo nữ.
const VOICE_BY_ROLE: Record<string, string> = { PRUEFER: 'ANNA', PARTNER: 'THOMAS' }

// KHÔNG đường phát nào được tin vào event một mình — QA prod 25/08 bắt được ca <audio> blob treo
// readyState 0 KHÔNG bắn event nào (không loadedmetadata/error, play() không settle) ⇒ gate kẹt vĩnh viễn.
// Watchdog: trần theo độ dài câu (100ms/ký tự ~ chậm hơn tốc độ đọc thật 67–83ms/ký tự nên không cắt sớm);
// khi biết thời lượng thật (loadedmetadata) thì siết trần về duration + đệm.
const SPEECH_START_GUARD_MS = 1500
const SPEECH_MS_PER_CHAR = 100
const SPEECH_BASE_MS = 3000
const SPEECH_MAX_MS = 30_000
const AUDIO_DURATION_BUFFER_MS = 2000

const textCapMs = (text: string) => Math.min(SPEECH_BASE_MS + text.length * SPEECH_MS_PER_CHAR, SPEECH_MAX_MS)

let current: HTMLAudioElement | null = null
let currentDone: (() => void) | null = null
let muted = false

export function setExamTtsMuted(value: boolean): void {
  muted = value
  if (value) stopExamTts()
}

export function isExamTtsMuted(): boolean {
  return muted
}

export function stopExamTts(): void {
  if (current) {
    current.pause()
    current = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
  const done = currentDone
  currentDone = null
  done?.()
}

export async function speakExamLine(role: string, text: string): Promise<void> {
  if (muted || !text?.trim()) return
  stopExamTts()
  const persona = VOICE_BY_ROLE[role] ?? 'DEFAULT'
  try {
    // 20s thay trần mặc định 8s: câu Prüfer dài sinh audio lâu; hụt trần là rơi xuống Web Speech oan.
    const resp = await api.post('/ai-speaking/tts', { text, persona }, { responseType: 'blob', timeout: 20_000 })
    const blob = resp.data as Blob
    // 2xx nhưng body rỗng = backend CHỦ Ý không trả audio (TTS tắt / e2e mock 204) → coi như đã
    // "nói xong" ngay, KHÔNG fallback Web Speech (fallback chỉ dành cho lỗi thật: network/5xx).
    if (!blob || blob.size === 0) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    current = audio
    await new Promise<void>((resolve) => {
      let settled = false
      let guard: ReturnType<typeof setTimeout> | null = null
      const done = () => {
        if (settled) return
        settled = true
        if (guard) clearTimeout(guard)
        URL.revokeObjectURL(url)
        if (current === audio) {
          audio.pause()
          current = null
        }
        if (currentDone === done) currentDone = null
        resolve()
      }
      const armGuard = (ms: number) => {
        if (guard) clearTimeout(guard)
        guard = setTimeout(done, ms)
      }
      currentDone = done
      // Watchdog ngay từ đầu theo độ dài câu — phòng ca media treo không event (QA prod 25/08).
      armGuard(textCapMs(text))
      audio.onloadedmetadata = () => {
        // Biết thời lượng thật → siết trần: audio phát xong mà 'ended' không tới cũng chỉ trễ 2s.
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          armGuard(audio.duration * 1000 + AUDIO_DURATION_BUFFER_MS)
        }
      }
      audio.onended = done
      audio.onerror = done
      audio.play().catch(done)
    })
  } catch {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    // Headless/không có giọng đọc → speak() im lặng và không bắn event nào: bỏ qua ngay cho tất định.
    if (synth.getVoices().length === 0) return
    await new Promise<void>((resolve) => {
      let settled = false
      let endGuard: ReturnType<typeof setTimeout> | null = null
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(startGuard)
        if (endGuard) clearTimeout(endGuard)
        if (currentDone === done) currentDone = null
        resolve()
      }
      currentDone = done
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'de-DE'
      u.rate = 0.95
      u.onstart = () => {
        clearTimeout(startGuard)
        endGuard = setTimeout(done, textCapMs(text))
      }
      u.onend = done
      u.onerror = done
      const startGuard = setTimeout(() => {
        synth.cancel()
        done()
      }, SPEECH_START_GUARD_MS)
      synth.cancel()
      synth.speak(u)
    })
  }
}
