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

/**
 * Kết quả một lần đọc — để UI (nút "Nghe thử") báo được cho học viên thay vì im lặng.
 * - `played`: đã phát (server TTS hoặc giọng máy)
 * - `blocked`: trình duyệt CHẶN phát (iOS Safari: play() ngoài cử chỉ chạm → NotAllowedError)
 * - `failed`: không phát được (server lỗi và không có giọng máy)
 * - `skipped`: tắt tiếng / câu rỗng / backend chủ ý không trả audio
 */
export type ExamSpeakOutcome = 'played' | 'blocked' | 'failed' | 'skipped'

/**
 * iOS Safari (QA prod 09/11/2026, iPhone: bấm "Nghe thử" không nghe gì, phòng thi giám khảo im lặng):
 * play() chỉ được phép khi gọi ĐỒNG BỘ trong cử chỉ chạm. speakExamLine chờ API TTS rồi mới play() một
 * `new Audio()` mới ⇒ cử chỉ đã hết hạn ⇒ NotAllowedError ⇒ trước đây resolve im lặng. Cách chữa chuẩn:
 * MỘT thẻ <audio> dùng chung, được "mở khoá" bằng một đoạn im lặng ngay trong lần chạm đầu tiên;
 * thẻ đã mở khoá thì về sau đổi src và play() bằng code vẫn được phép.
 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRuwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YcgAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

let player: HTMLAudioElement | null = null
let unlocked = false
let current: HTMLAudioElement | null = null
let currentDone: (() => void) | null = null
let muted = false

function sharedPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio()
    player.preload = 'auto'
  }
  return player
}

const UNLOCK_EVENTS = ['touchend', 'click', 'keydown'] as const

/**
 * Mở khoá phát âm thanh — PHẢI gọi đồng bộ trong handler của cử chỉ người dùng (chạm/bấm/phím).
 * Idempotent; không cắt lời đang phát. Module tự gắn listener toàn trang nên mọi lần chạm đầu tiên
 * (nút "Vào phòng", đóng hướng dẫn…) đều mở khoá; gọi tay ở "Nghe thử" cho chắc.
 */
export function unlockExamAudio(): void {
  if (unlocked || typeof window === 'undefined') return
  const audio = sharedPlayer()
  if (current === audio) return
  try {
    audio.src = SILENT_WAV
    const p = audio.play()
    if (p && typeof p.then === 'function') {
      p.then(
        () => {
          unlocked = true
          detachUnlockListeners()
        },
        () => {
          // Bị chặn (không phải cử chỉ hợp lệ) hoặc bị src mới cắt ngang — thử lại ở lần chạm sau.
        },
      )
    } else {
      unlocked = true
      detachUnlockListeners()
    }
  } catch {
    // Trình duyệt lạ — bỏ qua, speakExamLine vẫn tự lo đường lui.
  }
  // Giọng máy (Web Speech) trên iOS cũng cần một lần speak trong cử chỉ.
  try {
    const synth = window.speechSynthesis
    if (synth && !synth.speaking) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      synth.speak(u)
    }
  } catch {
    // không có Web Speech — bỏ qua.
  }
}

function detachUnlockListeners(): void {
  for (const ev of UNLOCK_EVENTS) document.removeEventListener(ev, unlockExamAudio, true)
}

if (typeof document !== 'undefined') {
  for (const ev of UNLOCK_EVENTS) document.addEventListener(ev, unlockExamAudio, true)
}

const isNotAllowed = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'NotAllowedError'

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

// Âm thanh đã xin trước cho các câu sắp đọc (bài nghe nhiều lượt lời). Không có nó thì mỗi lượt lời chỉ
// bắt đầu xin audio khi lượt trước vừa dứt ⇒ giữa hai nhân vật có một quãng chết 1–3 giây (owner phản
// hồi 13/11/2026: "khựng giữa việc chuyển lời của 2 nhân vật"). Dùng một lần rồi bỏ; giữ tối đa vài câu.
const PREPARED_MAX = 8
const prepared = new Map<string, Promise<Blob>>()
const lineKey = (role: string, text: string) => `${VOICE_BY_ROLE[role] ?? 'DEFAULT'}\u0000${text}`

function fetchLine(role: string, text: string): Promise<Blob> {
  const persona = VOICE_BY_ROLE[role] ?? 'DEFAULT'
  // 20s thay trần mặc định 8s: câu Prüfer dài sinh audio lâu; hụt trần là rơi xuống Web Speech oan.
  return api
    .post('/ai-speaking/tts', { text, persona }, { responseType: 'blob', timeout: 20_000 })
    .then((resp) => resp.data as Blob)
}

/** Xin trước audio của một câu sắp đọc. Lỗi thì im lặng: `speakExamLine` tự lo đường lui khi tới lượt. */
export function prepareExamLine(role: string, text: string): void {
  if (muted || !text?.trim()) return
  const key = lineKey(role, text)
  if (prepared.has(key)) return
  if (prepared.size >= PREPARED_MAX) {
    const oldest = prepared.keys().next().value
    if (oldest !== undefined) prepared.delete(oldest)
  }
  const p = fetchLine(role, text)
  p.catch(() => undefined)
  prepared.set(key, p)
}

export async function speakExamLine(role: string, text: string): Promise<ExamSpeakOutcome> {
  if (muted || !text?.trim()) return 'skipped'
  stopExamTts()
  try {
    const key = lineKey(role, text)
    const ready = prepared.get(key)
    prepared.delete(key)
    const blob = await (ready ?? fetchLine(role, text))
    // 2xx nhưng body rỗng = backend CHỦ Ý không trả audio (TTS tắt / e2e mock 204) → coi như đã
    // "nói xong" ngay, KHÔNG fallback Web Speech (fallback chỉ dành cho lỗi thật: network/5xx).
    if (!blob || blob.size === 0) return 'skipped'
    const url = URL.createObjectURL(blob)
    // Thẻ dùng chung (đã mở khoá trong cử chỉ chạm) — xem unlockExamAudio.
    const audio = sharedPlayer()
    audio.src = url
    current = audio
    let outcome: ExamSpeakOutcome = 'played'
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
      audio.onerror = () => {
        outcome = 'failed'
        done()
      }
      audio.play().then(
        () => {
          unlocked = true
        },
        (e: unknown) => {
          // iOS chặn autoplay → báo 'blocked' cho UI thay vì giả vờ "đã nói xong" trong im lặng.
          outcome = isNotAllowed(e) ? 'blocked' : 'failed'
          done()
        },
      )
    })
    return outcome
  } catch {
    if (typeof window === 'undefined' || !window.speechSynthesis) return 'failed'
    const synth = window.speechSynthesis
    // Headless/không có giọng đọc → speak() im lặng và không bắn event nào: bỏ qua ngay cho tất định.
    if (synth.getVoices().length === 0) return 'failed'
    let started = false
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
        started = true
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
    return started ? 'played' : 'failed'
  }
}
