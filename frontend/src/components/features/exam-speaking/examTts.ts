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
const legacyPersona = (role: string) => VOICE_BY_ROLE[role] ?? 'DEFAULT'
// Khoá nhớ gồm persona được yêu cầu VÀ persona cũ theo vai: hai thứ đó quyết định persona thật sự gửi đi
// (persona mới nếu sidecar có, không thì persona cũ), nên cùng một câu đọc bằng giọng khác không bao giờ dùng lẫn audio.
const lineKey = (role: string, text: string, persona?: string) => `${persona || ''}\u0000${legacyPersona(role)}\u0000${text}`

// Persona của bài nghe (`HOER_*`, mỗi nhân vật một giọng — 14/11/2026) chỉ có khi container sidecar đã được
// build lại. Sidecar cũ gặp persona lạ thì KHÔNG báo lỗi mà lặng lẽ đọc bằng giọng DEFAULT, nên phải hỏi rõ
// backend (`GET /ai-speaking/tts/personas`) trước khi gửi persona tường minh. Backend cũ (404), lỗi mạng, danh
// sách rỗng hoặc thiếu persona đó ⇒ coi như chưa hỗ trợ ⇒ đọc bằng persona cũ theo vai (ANNA/THOMAS).
// Chỉ hỏi khi có persona tường minh: phòng thi nói (không truyền persona) không tốn lời gọi nào.
const PERSONAS_RECHECK_MS = 5 * 60_000
let knownPersonas: Promise<ReadonlySet<string> | null> | null = null
let knownPersonasUntil = 0

function loadKnownPersonas(): Promise<ReadonlySet<string> | null> {
  if (knownPersonas && Date.now() < knownPersonasUntil) return knownPersonas
  const attempt: Promise<ReadonlySet<string> | null> = api
    .get('/ai-speaking/tts/personas', { timeout: 6000 })
    .then((resp) => {
      const list: unknown = (resp.data as { personas?: unknown } | null)?.personas
      const names = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
      return new Set(names.map((x) => x.toUpperCase()))
    })
    .catch(() => null)
  knownPersonas = attempt
  knownPersonasUntil = Date.now() + PERSONAS_RECHECK_MS
  void attempt.then((set) => {
    // Đã thấy persona bài nghe ⇒ nhớ tới hết phiên trang. Chưa thấy (hoặc hỏi lỗi) ⇒ 5 phút sau hỏi lại,
    // để tab đang mở tự dùng giọng mới sau khi sidecar được build lại.
    if (knownPersonas === attempt && set && Array.from(set).some((x) => x.startsWith('HOER_'))) knownPersonasUntil = Infinity
  })
  return attempt
}

/** Chỉ dùng trong test: quên câu trả lời "sidecar có persona nào" và các câu đã xin trước. */
export function resetExamTtsPersonaSupport(): void {
  knownPersonas = null
  knownPersonasUntil = 0
  prepared.clear()
}

/** Sidecar đang chạy có persona này không (hỏi backend một lần rồi nhớ). Không hỏi được ⇒ `false`. */
export async function isExamPersonaSupported(persona: string): Promise<boolean> {
  const known = await loadKnownPersonas()
  return known?.has(persona.toUpperCase()) ?? false
}

const hasHttpResponse = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { response?: unknown }).response != null

function postLine(text: string, persona: string): Promise<Blob> {
  // 20s thay trần mặc định 8s: câu Prüfer dài sinh audio lâu; hụt trần là rơi xuống Web Speech oan.
  return api
    .post('/ai-speaking/tts', { text, persona }, { responseType: 'blob', timeout: 20_000 })
    .then((resp) => resp.data as Blob)
}

async function fetchLine(role: string, text: string, persona?: string): Promise<Blob> {
  const legacy = legacyPersona(role)
  // Không truyền persona (phòng thi nói, kiểm tra micro…) ⇒ đúng một lời gọi như trước, persona theo vai.
  if (!persona || persona === legacy) return postLine(text, legacy)
  if (!(await isExamPersonaSupported(persona))) return postLine(text, legacy)
  try {
    return await postLine(text, persona)
  } catch (e) {
    // Máy chủ TỪ CHỐI persona mới (422 khi sidecar vừa bị lùi bản, 5xx…) ⇒ thử lại bằng persona cũ trước khi
    // để caller rơi xuống giọng máy của trình duyệt. Hết giờ / mất mạng thì không thử lại (chỉ kéo dài quãng im).
    if (!hasHttpResponse(e)) throw e
    return postLine(text, legacy)
  }
}

/**
 * Xin trước audio của một câu sắp đọc. Lỗi thì im lặng: `speakExamLine` tự lo đường lui khi tới lượt.
 * `persona` (tuỳ chọn) như ở `speakExamLine`.
 */
export function prepareExamLine(role: string, text: string, persona?: string): void {
  if (muted || !text?.trim()) return
  const key = lineKey(role, text, persona)
  if (prepared.has(key)) return
  if (prepared.size >= PREPARED_MAX) {
    const oldest = prepared.keys().next().value
    if (oldest !== undefined) prepared.delete(oldest)
  }
  const p = fetchLine(role, text, persona)
  p.catch(() => undefined)
  prepared.set(key, p)
}

/**
 * Đọc một câu. `role` chọn giọng theo vai như trước nay (`PRUEFER` → ANNA, `PARTNER` → THOMAS).
 * `persona` (tuỳ chọn, bài nghe): persona tường minh của sidecar (`HOER_F1`…); sidecar chưa có hoặc máy chủ
 * từ chối thì câu đó đọc bằng persona theo `role` — không rơi thẳng xuống giọng máy.
 */
export async function speakExamLine(role: string, text: string, persona?: string): Promise<ExamSpeakOutcome> {
  if (muted || !text?.trim()) return 'skipped'
  stopExamTts()
  try {
    const key = lineKey(role, text, persona)
    const ready = prepared.get(key)
    prepared.delete(key)
    const blob = await (ready ?? fetchLine(role, text, persona))
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
